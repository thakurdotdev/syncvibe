const User = require("../../models/auth/userModel")
const Comment = require("../../models/post/commentModel")

const getComments = async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { postid: req.params.postid },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "profilepic", "username"],
        },
        {
          model: Comment,
          as: "parentComment",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["name", "username"],
            },
          ],
        },
      ],
      order: [["createdat", "DESC"]],
    })

    // Transform the comments to include replyingTo information
    const transformedComments = comments.map((comment) => {
      const plainComment = comment.get({ plain: true })
      return {
        id: plainComment.id,
        comment: plainComment.comment,
        postid: plainComment.postid,
        createdby: plainComment.createdby,
        createdat: plainComment.createdat,
        parentCommentId: plainComment.parentCommentId,
        user: plainComment.user,
        replyingTo: plainComment.parentComment?.user?.name || null,
      }
    })

    res.status(200).json({
      comments: transformedComments,
      total: transformedComments.length,
    })
  } catch (err) {
    console.error("Error fetching comments:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

module.exports = getComments
