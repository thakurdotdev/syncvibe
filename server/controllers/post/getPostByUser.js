const sequelize = require("../../utils/sequelize")

const getPostByUser = async (req, res) => {
  try {
    const userid = req.params.userid
    const currentUser = req.user.userid
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const offset = (page - 1) * limit

    // Calculate total stats for the user
    const statsQuery = await sequelize.query(
      `
      SELECT 
        COUNT(DISTINCT p."postid") as "totalPosts",
        COUNT(DISTINCT l."id") as "totalLikes",
        COUNT(DISTINCT c."id") as "totalComments",
        (
          SELECT COALESCE(SUM(jsonb_array_length(p2.images::jsonb)), 0)
          FROM posts p2
          WHERE p2.createdby = :userid
        ) as "totalImages"
      FROM posts p
      LEFT JOIN likedislikes l ON p.postid = l.postid AND l.liked = true
      LEFT JOIN comments c ON p.postid = c.postid
      WHERE p.createdby = :userid
    `,
      {
        replacements: { userid },
        type: sequelize.QueryTypes.SELECT,
      },
    )

    const stats = statsQuery[0] || {
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalImages: 0,
    }

    const posts = await sequelize.query(
      `
      SELECT "posts".*, "user"."name", "user"."profilepic", "user"."username",
        COUNT(DISTINCT "likes"."id") AS "likesCount",
        COUNT(DISTINCT "comments"."id") AS "commentsCount",
        EXISTS (
          SELECT 1
          FROM "likedislikes" AS "userLikes"
          WHERE "userLikes"."postid" = "posts"."postid"
            AND "userLikes"."userid" = :currentUser
            AND "userLikes"."liked" = true
        ) AS "likedByCurrentUser"
      FROM "posts"
      LEFT JOIN "users" AS "user" ON "posts"."createdby" = "user"."userid"
      LEFT JOIN "likedislikes" AS "likes" ON "posts"."postid" = "likes"."postid" AND "likes"."liked" = true
      LEFT JOIN "comments" AS "comments" ON "posts"."postid" = "comments"."postid"
      WHERE "posts"."createdby" = :userid AND ("posts"."showpost" = true OR "posts"."createdby" = :currentUser)
      GROUP BY "posts"."postid", "user"."userid"
      ORDER BY "posts"."postedtime" DESC
      LIMIT :limit OFFSET :offset
    `,
      {
        replacements: { limit, offset, userid, currentUser },
        type: sequelize.QueryTypes.SELECT,
      },
    )

    res.status(200).json({
      stats: {
        totalPosts: parseInt(stats.totalPosts, 10) || 0,
        totalLikes: parseInt(stats.totalLikes, 10) || 0,
        totalComments: parseInt(stats.totalComments, 10) || 0,
        totalImages: parseInt(stats.totalImages, 10) || 0,
      },
      posts,
      hasMore: parseInt(stats.totalPosts, 10) > offset + limit,
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

module.exports = getPostByUser
