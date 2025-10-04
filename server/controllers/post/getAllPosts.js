const Post = require('../../models/post/postModel');
const sequelize = require('../../utils/sequelize');

const getAllPosts = async (req, res) => {
  try {
    const userid = req.user.userid;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [totalPosts, posts] = await Promise.all([
      Post.count({ where: { showpost: true } }),
      sequelize.query(
        `
        SELECT p.*, u.name, u.profilepic, u.username,
          COALESCE(l.likesCount, 0) AS "likesCount",
          COALESCE(c.commentsCount, 0) AS "commentsCount",
          (CASE WHEN ul.userid IS NOT NULL THEN true ELSE false END) AS "likedByCurrentUser"
        FROM posts p
        JOIN users u ON p.createdby = u.userid
        LEFT JOIN (
          SELECT postid, COUNT(*) AS likesCount
          FROM likedislikes
          WHERE liked = true
          GROUP BY postid
        ) l ON p.postid = l.postid
        LEFT JOIN (
          SELECT postid, COUNT(*) AS commentsCount
          FROM comments
          GROUP BY postid
        ) c ON p.postid = c.postid
        LEFT JOIN likedislikes ul ON p.postid = ul.postid AND ul.userid = :userid AND ul.liked = true
        WHERE p.showpost = true
        ORDER BY p.postedtime DESC
        LIMIT :limit OFFSET :offset
      `,
        {
          replacements: { limit, offset, userid },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
    ]);

    res.status(200).json({ totalPosts, posts });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = getAllPosts;
