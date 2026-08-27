import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppUpdate } from '@/models/index';
import { buildPublishedMailSender } from '@/utils/resend';

export const getLatestUpdate = async (_req: Request, res: Response): Promise<void> => {
  try {
    const latest = await AppUpdate.findOne({ order: [['createdAt', 'DESC']], raw: true });
    res.status(200).json({ success: true, latest });
  } catch (error) {
    console.error('Error fetching latest update:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAllUpdates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const updates = await AppUpdate.findAll({ order: [['createdAt', 'DESC']], raw: true });
    res.status(200).json({ success: true, updates });
  } catch (error) {
    console.error('Error fetching app updates history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const downloadLatestUpdate = async (_req: Request, res: Response): Promise<void> => {
  try {
    const latest = await AppUpdate.findOne({ order: [['createdAt', 'DESC']], raw: true });
    if (!latest?.downloadUrl) {
      res.status(404).json({ success: false, message: 'No release APK available' });
      return;
    }
    res.redirect(latest.downloadUrl);
  } catch (error) {
    console.error('Error redirecting to latest update download:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPresignedUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const version = req.query.version as string | undefined;
    if (!version) {
      res.status(400).json({ success: false, message: 'Version is required' });
      return;
    }

    const existingUpdate = await AppUpdate.findOne({ where: { version } });
    if (existingUpdate) {
      res.status(400).json({ success: false, message: 'This version already exists' });
      return;
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const fileKey = `updates/syncvibe-v${version}.apk`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: 'application/vnd.android.package-archive',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const downloadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    res.status(200).json({ success: true, uploadUrl, downloadUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.email !== process.env.ADMIN_EMAIL) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const { version, releaseNotes, downloadUrl, critical, sha256, fileSize } = req.body as {
      version?: string;
      releaseNotes?: string;
      downloadUrl?: string;
      critical?: boolean;
      sha256?: string;
      fileSize?: number;
    };

    if (!version || !downloadUrl) {
      res.status(400).json({ success: false, message: 'Version and download URL are required' });
      return;
    }

    const update = await AppUpdate.create({
      version,
      releaseNotes: releaseNotes ?? null,
      downloadUrl,
      critical: !!critical,
      sha256: sha256 ? String(sha256).trim() : null,
      fileSize: fileSize ? Number(fileSize) : null,
    });

    if (process.env.ADMIN_EMAIL) {
      buildPublishedMailSender(process.env.ADMIN_EMAIL, {
        version,
        releaseNotes: releaseNotes ?? '',
        downloadUrl,
        fileSize: fileSize ? Number(fileSize) : undefined,
        sha256: sha256 ? String(sha256).trim() : undefined,
        platform: 'Android',
      }).catch((err: Error) => console.error('Failed to send build notification email:', err));
    }

    res.status(201).json({ success: true, update });
  } catch (error) {
    console.error('Error creating update record:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
