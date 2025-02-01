const multer = require("multer");
const storage = multer.memoryStorage();

const fileHandleMiddleware = multer({
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max file size for videos
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

// Check file type
function checkFileType(file, cb) {
  // Allowed file extensions for both images and videos
  const allowedTypes = {
    image: /jpeg|jpg|png|gif|webp/,
    video: /mp4|mov|avi|mkv/,
  };

  // Get the file type (image or video)
  const fileType = file.mimetype.startsWith("video/") ? "video" : "image";

  // Get the appropriate regex for the file type
  const filetypes = allowedTypes[fileType];

  // Check the extension and mime type
  const extname = filetypes.test(file.originalname.toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  // Validate file size based on type
  const maxSize = fileType === "video" ? 30 * 1024 * 1024 : 5 * 1024 * 1024;

  if (file.size > maxSize) {
    return cb(
      `Error: File too large. Maximum size for ${fileType}s is ${
        maxSize / (1024 * 1024)
      }MB`,
    );
  }

  if (mimetype && extname) {
    // Add file type to request for later use
    file.mediaType = fileType;
    return cb(null, true);
  } else {
    cb(
      `Error: Only ${Object.keys(allowedTypes).join(
        " and ",
      )} files are allowed!`,
    );
  }
}

// Export multiple middleware functions
module.exports = fileHandleMiddleware;
