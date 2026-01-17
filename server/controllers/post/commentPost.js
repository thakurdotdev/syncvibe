const Comment = require("../../models/post/commentModel")

const commentPost = async (req, res) => {
  const { comment, postid, parentCommentId } = req.body
  const { userid, name, profilepic } = req.user

  try {
    if (!postid || !comment || !userid) {
      return res.status(400).json({ message: "All Fields required." })
    }

    const newComment = await Comment.create({
      comment,
      postid,
      createdby: userid,
      parentCommentId: parentCommentId || null, // Null for top-level comments
    })

    res.status(200).json({
      message: "Success",
      data: {
        id: newComment.id,
        comment: newComment.comment,
        postid: newComment.postid,
        createdby: newComment.createdby,
        createdat: newComment.createdat,
        parentCommentId: newComment.parentCommentId,
        user: {
          name,
          profilepic,
        },
      },
    })
  } catch (error) {
    console.error("Error While Commenting:", error)
    res.status(500).json({ message: "Error While Commenting" })
  }
}

module.exports = commentPost
