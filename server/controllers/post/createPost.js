const Post = require("../../models/post/postModel")

const validatePostContent = (title, hasImages) => {
  if (!title && !hasImages) {
    throw {
      status: 400,
      message: "Either title or images are required for creating a post",
      code: "VALIDATION_ERROR",
    }
  }
}

const validateImageUrls = (images) => {
  if (!Array.isArray(images)) return false
  return images.every(
    (img) =>
      img &&
      typeof img.image === "string" &&
      typeof img.id === "string" &&
      img.image.includes("cloudinary.com"),
  )
}

const createPost = async (req, res) => {
  try {
    const { userid: createdby, name, profilepic } = req.user
    const { title, images = [] } = req.body

    const hasImages = images.length > 0

    validatePostContent(title, hasImages)

    if (hasImages && !validateImageUrls(images)) {
      return res.status(400).json({
        message: "Invalid image format. Expected array of {image, id} objects with Cloudinary URLs",
        code: "VALIDATION_ERROR",
      })
    }

    const post = await Post.create({
      title: title || null,
      createdby,
      images,
    })

    const responsePost = {
      ...post.dataValues,
      name,
      profilepic,
    }

    return res.status(200).json({
      message: "success",
      post: responsePost,
    })
  } catch (error) {
    console.error("Post creation error:", error)
    return res.status(error.status || 500).json({
      message: error.message || "Internal server error",
      code: error.code,
    })
  }
}

module.exports = createPost
