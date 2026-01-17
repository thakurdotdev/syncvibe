const UPLOAD_CONFIG = {
  image: {
    maxFileSize: 5 * 1024 * 1024,
    allowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
  },
  video: {
    maxFileSize: 30 * 1024 * 1024,
    allowedFormats: ["mp4", "webm", "mov"],
  },
}

const FOLDER_CONFIG = {
  posts: { allowedTypes: ["image"] },
  stories: { allowedTypes: ["image", "video"] },
  profiles: { allowedTypes: ["image"] },
}

const RATE_LIMIT = {
  maxSignatures: 10,
  windowMs: 60 * 1000,
}

module.exports = {
  UPLOAD_CONFIG,
  FOLDER_CONFIG,
  RATE_LIMIT,
}
