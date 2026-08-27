import type { Request, Response } from 'express';
import { v2 as Cloudinary } from 'cloudinary';
import crypto from 'node:crypto';
import { UPLOAD_CONFIG, FOLDER_CONFIG, RATE_LIMIT, type UploadFolder } from '@/config/upload';
import { cache } from '@/utils/redis';

const checkRateLimit = async (userId: number): Promise<boolean> => {
  const windowSeconds = Math.ceil(RATE_LIMIT.windowMs / 1000);
  const key = `ratelimit:upload_sig:${userId}`;
  const count = await cache.incr(key, windowSeconds);
  if (count === null) return true;
  return count <= RATE_LIMIT.maxSignatures;
};

const INTENT_TO_FOLDER: Record<string, UploadFolder> = {
  post: 'posts',
  story: 'stories',
  profile: 'profiles',
  chat: 'chat',
};

const resolveFolder = (intent: string): UploadFolder | null => {
  const folder = INTENT_TO_FOLDER[intent];
  if (!folder || !FOLDER_CONFIG[folder]) return null;
  return folder;
};

export const getUploadSignature = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid, role } = req.user!;
    const intent = (req.query.intent as string) || 'post';
    const resourceType = (req.query.resourceType as string) || 'image';

    if (role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot upload files', code: 'FORBIDDEN' });
      return;
    }

    const isAllowed = await checkRateLimit(userid);
    if (!isAllowed) {
      res.status(429).json({
        message: 'Too many upload requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    const folder = resolveFolder(intent);
    if (!folder) {
      res.status(400).json({ message: 'Invalid upload intent', code: 'VALIDATION_ERROR' });
      return;
    }

    const folderConfig = FOLDER_CONFIG[folder];
    if (!(folderConfig.allowedTypes as readonly string[]).includes(resourceType)) {
      res.status(400).json({
        message: `${resourceType} uploads not allowed for ${intent}`,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const uploadConfig = UPLOAD_CONFIG[resourceType as keyof typeof UPLOAD_CONFIG];
    if (!uploadConfig) {
      res.status(400).json({ message: 'Invalid resource type', code: 'VALIDATION_ERROR' });
      return;
    }

    const timestamp = Math.round(Date.now() / 1000);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const publicId = `${folder}_${userid}_${timestamp}_${uniqueId}`;

    const paramsToSign = {
      timestamp,
      folder,
      public_id: publicId,
      allowed_formats: uploadConfig.allowedFormats.join(','),
      overwrite: false,
    };

    const signature = Cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_SECRET
    );

    console.log(
      `[UPLOAD_SIGNATURE] userId=${userid} folder=${folder} resourceType=${resourceType} publicId=${publicId} timestamp=${timestamp}`
    );

    res.status(200).json({
      signature,
      timestamp,
      cloudName: process.env.CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_KEY,
      folder,
      publicId,
      resourceType,
      allowedFormats: uploadConfig.allowedFormats,
      maxFileSize: uploadConfig.maxFileSize,
    });
  } catch (error) {
    console.error('Error generating upload signature:', error);
    res.status(500).json({ message: 'Failed to generate upload signature', code: 'SERVER_ERROR' });
  }
};
