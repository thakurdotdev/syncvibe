const Post = require("../../models/post/postModel")

const updatePost = async (req, res) => {
  const createdby = req.user.userid
  const postid = req.params.postid

  if (req.user.role === "guest") {
    return res.status(403).json({ message: "Guest users cannot update posts" })
  }

  try {
    const { title, images } = req.body
    const updateData = {}

    if (title !== undefined) updateData.title = title
    if (images !== undefined) updateData.images = images

    await Post.update(updateData, { where: { postid, createdby } })

    res.status(200).json({ message: "success" })
  } catch (err) {
    console.log("Error", err.message)
    return res.status(500).json({ message: err.message })
  }
}

module.exports = updatePost
