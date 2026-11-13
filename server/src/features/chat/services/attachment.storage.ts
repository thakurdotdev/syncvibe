import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Chat files live in their own R2 bucket with no public access (R2_CHAT_BUCKET_NAME), unlike the
 * app-update bucket, which is served on a public domain. Nobody can read a file without a link
 * the server signed, and the server signs links only for the conversation's members.
 */

/** How long a device has to start its upload. */
const UPLOAD_LINK_SECONDS = 15 * 60;

/**
 * Read links are signed as of the start of a window, so every request in the same window gets
 * the same address and browsers and the app can reuse what they already downloaded. Each link
 * lasts two windows: at least one full window after it was handed out.
 */
const READ_WINDOW_MS = 6 * 60 * 60 * 1000;
const READ_LINK_SECONDS = (2 * READ_WINDOW_MS) / 1000;

let client: S3Client | null = null;

const bucket = () => process.env.R2_CHAT_BUCKET_NAME;

/** Whether chat files are set up on this server. */
export const attachmentsEnabled = (): boolean =>
  Boolean(
    bucket() &&
    process.env.R2_ENDPOINT &&
    (process.env.R2_CHAT_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID) &&
    (process.env.R2_CHAT_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)
  );

const s3 = (): S3Client => {
  client ??= new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_CHAT_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_CHAT_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
    },
    // R2 doesn't take the checksums newer SDKs add by default; in a signed upload link they
    // would make every upload fail.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return client;
};

/**
 * Somewhere to PUT exactly this file. Its type and length are part of the signature, so R2
 * refuses an upload of any other size or type.
 */
export const signUpload = async (
  key: string,
  mime: string,
  size: number
): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }> => {
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime, ContentLength: size }),
    { expiresIn: UPLOAD_LINK_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) }
  );
  return {
    url,
    headers: { 'Content-Type': mime },
    expiresAt: new Date(Date.now() + UPLOAD_LINK_SECONDS * 1000).toISOString(),
  };
};

export interface ReadOptions {
  contentType: string;
  disposition: string;
}

/** A link that reads the file for a while. Signing happens here, with no request to R2. */
export const signRead = async (
  key: string,
  { contentType, disposition }: ReadOptions,
  now = Date.now()
): Promise<{ url: string; expiresAt: string }> => {
  const signedAt = Math.floor(now / READ_WINDOW_MS) * READ_WINDOW_MS;
  const url = await getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: disposition,
      // Files never change once uploaded.
      ResponseCacheControl: 'private, max-age=43200, immutable',
    }),
    { expiresIn: READ_LINK_SECONDS, signingDate: new Date(signedAt) }
  );
  return { url, expiresAt: new Date(signedAt + READ_LINK_SECONDS * 1000).toISOString() };
};

/** The stored file's size and type, or null if nothing was uploaded. */
export const inspect = async (
  key: string
): Promise<{ size: number; contentType: string | null } | null> => {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
};

/** The first `length` bytes of the stored file. */
export const readStart = async (key: string, length: number): Promise<Uint8Array> => {
  const object = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${length - 1}` })
  );
  return object.Body ? object.Body.transformToByteArray() : new Uint8Array();
};

export const removeObject = async (key: string): Promise<void> => {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
};
