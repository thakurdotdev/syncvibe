import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

const storage = multer.memoryStorage();

type FileType = 'image' | 'video';

const allowedTypes: Record<FileType, RegExp> = {
  image: /jpeg|jpg|png|gif|webp/,
  video: /mp4|mov|avi|mkv/,
};

function checkFileType(file: Express.Multer.File, cb: FileFilterCallback): void {
  const fileType: FileType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  const filetypes = allowedTypes[fileType];

  const extname = filetypes.test(file.originalname.toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  const maxSize = fileType === 'video' ? 30 * 1024 * 1024 : 5 * 1024 * 1024;

  if (file.size > maxSize) {
    cb(new Error(`File too large. Maximum size for ${fileType}s is ${maxSize / (1024 * 1024)}MB`));
    return;
  }

  if (mimetype && extname) {
    (file as Express.Multer.File & { mediaType: string }).mediaType = fileType;
    cb(null, true);
  } else {
    cb(new Error(`Only ${Object.keys(allowedTypes).join(' and ')} files are allowed!`));
  }
}

const fileHandleMiddleware = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    checkFileType(file, cb);
  },
});

export default fileHandleMiddleware;
