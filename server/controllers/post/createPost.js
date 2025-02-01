const Post = require("../../models/post/postModel");
const Cloudinary = require("cloudinary").v2;
const User = require("../../models/auth/userModel");
const getDataUri = require("../../utils/dataUri");

// Validation helper function
const validatePostContent = (title, hasImages) => {
  if (!title && !hasImages) {
    throw {
      status: 400,
      message: "Either title or images are required for creating a post",
      code: "VALIDATION_ERROR",
    };
  }
};

// Separate function to handle image processing
const processImages = async (images) => {
  if (!images?.length) return [];

  try {
    // Process all images in parallel with optimized settings
    const uploadPromises = images.map((image) => {
      const dataUri = getDataUri(image);
      return Cloudinary.uploader.upload(
        dataUri.content,
        cloudinaryUploadConfig,
      );
    });

    const cloudinaryResponses = await Promise.all(uploadPromises);

    return cloudinaryResponses.map((image) => ({
      image: image.secure_url,
      id: image.public_id,
    }));
  } catch (error) {
    throw {
      status: 500,
      message: "Error uploading images",
      code: "UPLOAD_ERROR",
    };
  }
};

// Cloudinary upload configuration
const cloudinaryUploadConfig = {
  folder: "posts",
  quality: "auto:good",
  fetch_format: "auto",
};

const createPost = async (req, res) => {
  try {
    const { userid: createdby, name, profilepic } = req.user;
    const { title } = req.body;
    const hasImages = req?.files?.length > 0;

    // Validate that at least one of title or images exists
    validatePostContent(title, hasImages);

    // Get user and process images in parallel
    const imageUrls = await processImages(req.files);

    // Create post with all data in one go
    const post = await Post.create({
      title: title || null,
      createdby,
      images: imageUrls,
    });

    // Combine post data with user details without additional query
    const responsePost = {
      ...post.dataValues,
      name,
      profilepic,
    };

    return res.status(200).json({
      message: "success",
      post: responsePost,
    });
  } catch (error) {
    console.error("Post creation error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Internal server error",
      code: error.code,
    });
  }
};

module.exports = createPost;
