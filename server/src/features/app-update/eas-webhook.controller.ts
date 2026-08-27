import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { AppUpdate } from '@/models/index';
import { getRedis, cache } from '@/utils/redis';
import { buildPublishedMailSender } from '@/utils/resend';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 5,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 10_000, socketTimeout: 120_000 }),
});

const MAX_UPLOAD_ATTEMPTS = 3;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const uploadToR2WithRetry = async (
  tempFilePath: string,
  fileKey: string,
  attempt = 1
): Promise<void> => {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileKey,
        Body: fs.createReadStream(tempFilePath),
        ContentType: 'application/vnd.android.package-archive',
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false,
    });
    await upload.done();
  } catch (error) {
    if (attempt < MAX_UPLOAD_ATTEMPTS) {
      const backoffMs = attempt * 2000;
      console.warn(
        `R2 upload attempt ${attempt} failed (${(error as Error).message}), retrying in ${backoffMs}ms...`
      );
      await delay(backoffMs);
      return uploadToR2WithRetry(tempFilePath, fileKey, attempt + 1);
    }
    throw error;
  }
};

interface ArtifactData {
  buildUrl: string;
}

interface MetadataData {
  appVersion?: string;
  gitCommitMessage?: string;
}

const processUpdateInBackground = async (
  version: string,
  artifacts: ArtifactData,
  _metadata: MetadataData,
  releaseNotes: string
): Promise<void> => {
  let tempFilePath: string | null = null;
  try {
    console.log(`Processing app update v${version} in background`);
    const existingUpdate = await AppUpdate.findOne({ where: { version } });
    if (existingUpdate) {
      await cache.del(`pending-update:${version}`);
      return;
    }

    const response = await fetch(artifacts.buildUrl);
    if (!response.ok || !response.body)
      throw new Error(`Failed to fetch artifact: ${response.statusText}`);

    tempFilePath = path.join(import.meta.dirname, `temp-${version}.apk`);
    const fileStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(response.body as unknown as WebReadableStream)
        .pipe(fileStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log(`Downloaded app update v${version} to temp file: ${tempFilePath}`);

    const stats = fs.statSync(tempFilePath);
    const fileSize = stats.size;

    const hash = crypto.createHash('sha256');
    const hashStream = fs.createReadStream(tempFilePath);
    const sha256 = await new Promise<string>((resolve, reject) => {
      hashStream.on('data', (chunk: string | Buffer) => hash.update(chunk));
      hashStream.on('end', () => resolve(hash.digest('hex')));
      hashStream.on('error', reject);
    });

    console.log(`Calculated size (${fileSize} bytes) and SHA-256 (${sha256}) for v${version}`);

    const fileKey = `updates/syncvibe-v${version}.apk`;
    await uploadToR2WithRetry(tempFilePath, fileKey);

    const downloadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    await AppUpdate.create({
      version,
      releaseNotes,
      downloadUrl,
      critical: false,
      sha256,
      fileSize,
    });

    console.log(`Automatically published app update v${version} via EAS Webhook`);
    await cache.del(`pending-update:${version}`);

    if (process.env.ADMIN_EMAIL) {
      buildPublishedMailSender(process.env.ADMIN_EMAIL, {
        version,
        releaseNotes,
        downloadUrl,
        fileSize,
        sha256,
        platform: 'Android',
      }).catch((err: Error) => console.error('Failed to send build notification email:', err));
    }
  } catch (error) {
    console.error(`EAS Webhook background processing failed for v${version}:`, error);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }
  }
};

export const handleEasWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['expo-signature'] as string | undefined;
    const secret = process.env.EAS_WEBHOOK_SECRET;

    let payload: Record<string, unknown> = req.body as Record<string, unknown>;
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse((req.body as Buffer).toString()) as Record<string, unknown>;
    }

    if (secret && signature) {
      const hmac = crypto.createHmac('sha1', secret);
      const dataToSign = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      hmac.update(dataToSign);
      const calculated = `sha1=${hmac.digest('hex')}`;
      if (signature !== calculated) {
        res.status(401).json({ success: false, message: 'Invalid signature' });
        return;
      }
    }

    const { status, platform, artifacts, metadata } = payload as {
      status?: string;
      platform?: string;
      artifacts?: ArtifactData;
      metadata?: MetadataData;
    };

    if (status === 'finished' && platform === 'android' && artifacts?.buildUrl) {
      const version = metadata?.appVersion;
      const releaseNotes = metadata?.gitCommitMessage || 'New build uploaded automatically.';

      if (!version) {
        res.status(400).json({ success: false, message: 'Version missing in metadata' });
        return;
      }

      const existingUpdate = await AppUpdate.findOne({ where: { version } });
      if (existingUpdate) {
        res.status(200).json({ success: true, message: 'Version already exists' });
        return;
      }

      const isQueued = await cache.get(`pending-update:${version}`);
      if (isQueued) {
        res.status(202).json({ success: true, message: 'Update processing already in progress' });
        return;
      }

      await cache.set(`pending-update:${version}`, { artifacts, metadata, releaseNotes }, 86400);
      res.status(202).json({ success: true, message: 'Update processing initiated in background' });
      processUpdateInBackground(version, artifacts, metadata!, releaseNotes);
      return;
    }

    res.status(200).json({ success: true, message: 'Webhook received (no action taken)' });
  } catch (error) {
    console.error('EAS Webhook processing failed:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const resumePendingUpdates = async (): Promise<void> => {
  try {
    const redisClient = getRedis();
    if (!redisClient) return;

    const keys = await redisClient.keys('pending-update:*');
    if (keys.length === 0) return;

    console.log(`Found ${keys.length} pending app updates in Redis. Resuming...`);

    for (const key of keys) {
      const version = key.split(':')[1]!;
      const data = await cache.get<{
        artifacts: ArtifactData;
        metadata: MetadataData;
        releaseNotes: string;
      }>(key);
      if (!data) continue;
      processUpdateInBackground(version, data.artifacts, data.metadata, data.releaseNotes);
    }
  } catch (error) {
    console.error('Failed to resume pending app updates from Redis:', error);
  }
};
