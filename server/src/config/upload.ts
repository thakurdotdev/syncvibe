export const UPLOAD_CONFIG = {
  image: {
    maxFileSize: 5 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const,
  },
  video: {
    maxFileSize: 30 * 1024 * 1024,
    allowedFormats: ['mp4', 'webm', 'mov'] as const,
  },
} as const;

export type MediaType = keyof typeof UPLOAD_CONFIG;

export const FOLDER_CONFIG = {
  posts: { allowedTypes: ['image'] as const },
  stories: { allowedTypes: ['image', 'video'] as const },
  profiles: { allowedTypes: ['image'] as const },
  chat: { allowedTypes: ['image'] as const },
} as const;

export type UploadFolder = keyof typeof FOLDER_CONFIG;

export const RATE_LIMIT = {
  maxSignatures: 10,
  windowMs: 60 * 1000,
} as const;
