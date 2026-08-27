import type { Request, Response } from 'express';
import { Op, literal, QueryTypes } from 'sequelize';
import { Post, User, Comment, LikeDislike, Follower } from '@/models/index';
import type { ImageEntry } from '@/models/post/post.model';
import sequelize from '@/utils/sequelize';

const validateImageUrls = (images: unknown[]): images is ImageEntry[] => {
  if (!Array.isArray(images)) return false;
  return images.every(
    (img) =>
      img &&
      typeof (img as ImageEntry).url === 'string' &&
      typeof (img as ImageEntry).public_id === 'string' &&
      (img as ImageEntry).url.includes('cloudinary.com')
  );
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid: createdby, name, profilepic } = req.user!;
    const { title, images = [] } = req.body as { title?: string; images?: ImageEntry[] };

    const hasImages = images.length > 0;

    if (!title && !hasImages) {
      res.status(400).json({
        message: 'Either title or images are required for creating a post',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (hasImages && !validateImageUrls(images)) {
      res.status(400).json({
        message: 'Invalid image format. Expected array of {image, id} objects with Cloudinary URLs',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const post = await Post.create({
      title: title || null,
      createdby,
      images,
    });

    const responsePost = { ...post.get({ plain: true }), name, profilepic };

    res.status(200).json({ message: 'success', post: responsePost });
  } catch (error) {
    console.error('Post creation error:', error);
    const status = (error as { status?: number }).status || 500;
    res.status(status).json({
      message: (error as Error).message || 'Internal server error',
      code: (error as { code?: string }).code,
    });
  }
};

export const getAllPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = req.user?.userid ?? 0;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
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
        { replacements: { limit, offset, userid }, type: QueryTypes.SELECT }
      ),
    ]);

    res.status(200).json({ totalPosts, posts });
  } catch (err) {
    console.error('Error fetching all posts:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getPostById = async (req: Request, res: Response): Promise<void> => {
  const postid = parseInt(String(req.params.postid), 10);
  const userid = req.user!.userid;

  try {
    const post = await Post.findOne({
      where: { postid },
      include: [
        { model: User, as: 'user', attributes: ['name', 'profilepic', 'userid', 'username'] },
      ],
    });

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    const likes = await LikeDislike.count({ where: { postid, liked: true } });
    const followers = await Follower.count({ where: { followid: post.createdby } });

    const follower = await Follower.findOne({
      where: { followerid: userid, followid: post.createdby },
      raw: true,
    });

    const plainPost = post.get({ plain: true }) as Record<string, unknown>;
    plainPost.likes = likes;
    plainPost.isFollowing = !!follower;
    plainPost.followers = followers;

    res.status(200).json({ message: 'success', post: plainPost });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getPostByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = parseInt(String(req.params.userid), 10);
    const currentUser = req.user!.userid;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = (page - 1) * limit;

    const statsQuery = (await sequelize.query(
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
      { replacements: { userid }, type: QueryTypes.SELECT }
    )) as Array<{
      totalPosts: string;
      totalLikes: string;
      totalComments: string;
      totalImages: string;
    }>;

    const stats = statsQuery[0] ?? {
      totalPosts: '0',
      totalLikes: '0',
      totalComments: '0',
      totalImages: '0',
    };

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
      { replacements: { limit, offset, userid, currentUser }, type: QueryTypes.SELECT }
    );

    res.status(200).json({
      stats: {
        totalPosts: parseInt(stats.totalPosts, 10) || 0,
        totalLikes: parseInt(stats.totalLikes, 10) || 0,
        totalComments: parseInt(stats.totalComments, 10) || 0,
        totalImages: parseInt(stats.totalImages, 10) || 0,
      },
      posts,
      hasMore: parseInt(stats.totalPosts, 10) > offset + limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updatePost = async (req: Request, res: Response): Promise<void> => {
  const createdby = req.user!.userid;
  const postid = parseInt(String(req.params.postid), 10);
  const { title, images } = req.body as { title?: string; images?: ImageEntry[] };

  try {
    const post = await Post.findOne({ where: { postid, createdby } });

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    if (post.createdby !== createdby) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (title !== undefined) post.title = title;
    if (images !== undefined) post.images = images;

    await post.save();
    res.status(200).json({ message: 'success' });
  } catch (err) {
    console.error('Error', (err as Error).message);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
  const createdby = req.user!.userid;
  const postid = parseInt(String(req.params.postid), 10);

  if (req.user!.role === 'guest') {
    res.status(403).json({ message: 'Guest users cannot delete posts' });
    return;
  }

  try {
    const post = await Post.findOne({ where: { postid, createdby } });

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    if (post.createdby !== createdby) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    await post.destroy();
    await LikeDislike.destroy({ where: { postid } });
    await Comment.destroy({ where: { postid } });

    res.status(200).json({ message: 'success' });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const hidePost = async (req: Request, res: Response): Promise<void> => {
  const createdby = req.user!.userid;
  const postid = parseInt(String(req.params.postid), 10);

  try {
    const [numUpdated, updatedPosts] = await Post.update(
      { showpost: literal('NOT showpost') as unknown as boolean },
      { where: { postid, createdby }, returning: true }
    );

    if (numUpdated === 0) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    const updatedPost = updatedPosts[0]!;
    if (updatedPost.createdby !== createdby) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const message = updatedPost.showpost === false ? 'Post Hidden' : 'Post Un-Hidden';
    res.status(200).json({ message });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const toggleLikeDislikePost = async (req: Request, res: Response): Promise<void> => {
  const postid = parseInt(String(req.params.postid), 10);
  const { userid } = req.user!;

  try {
    if (!postid || !userid) {
      res.status(400).json({ error: 'Missing postid or userid in request body.' });
      return;
    }

    const existingLikeDislike = await LikeDislike.findOne({ where: { postid, userid } });

    if (existingLikeDislike) {
      const updatedLikeDislike = await existingLikeDislike.update({
        liked: !existingLikeDislike.liked,
      });
      res.status(200).json({ message: updatedLikeDislike.liked ? 'Post liked.' : 'Post unliked.' });
      return;
    }

    await LikeDislike.create({ postid, userid, liked: true });
    res.status(200).json({ message: 'Post liked.' });
  } catch (error) {
    console.error('Error liking/disliking post:', error);
    res.status(500).json({ error: 'An error occurred while liking/disliking the post.' });
  }
};

export const getLikeDislikeStatus = async (req: Request, res: Response): Promise<void> => {
  const postid = parseInt(String(req.params.postid), 10);
  const { userid } = req.user!;

  try {
    if (!postid || !userid) {
      res.status(400).json({ error: 'Missing postid or userid in request body.' });
      return;
    }

    const existingLikeDislike = await LikeDislike.findOne({ where: { postid, userid } });
    res.status(200).json({ liked: existingLikeDislike?.liked ?? false });
  } catch (error) {
    console.error('Error liking/disliking post:', error);
    res.status(500).json({ error: 'An error occurred while liking/disliking the post.' });
  }
};

export const commentPost = async (req: Request, res: Response): Promise<void> => {
  const { comment, postid, parentCommentId } = req.body as {
    comment?: string;
    postid?: number;
    parentCommentId?: number;
  };
  const { userid, name, profilepic } = req.user!;

  try {
    if (!postid || !comment || !userid) {
      res.status(400).json({ message: 'All Fields required.' });
      return;
    }

    const newComment = await Comment.create({
      comment,
      postid,
      createdby: userid,
      parentCommentId: parentCommentId ?? null,
    });

    res.status(200).json({
      message: 'Success',
      data: {
        id: newComment.id,
        comment: newComment.comment,
        postid: newComment.postid,
        createdby: newComment.createdby,
        createdat: newComment.createdat,
        parentCommentId: newComment.parentCommentId,
        user: { name, profilepic },
      },
    });
  } catch (error) {
    console.error('Error While Commenting:', error);
    res.status(500).json({ message: 'Error While Commenting' });
  }
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await Comment.findAll({
      where: { postid: parseInt(String(req.params.postid), 10) },
      include: [
        { model: User, as: 'user', attributes: ['name', 'profilepic', 'username'] },
        {
          model: Comment,
          as: 'parentComment',
          include: [{ model: User, as: 'user', attributes: ['name', 'username'] }],
        },
      ],
      order: [['createdat', 'DESC']],
    });

    const transformedComments = comments.map((comment) => {
      const plainComment = comment.get({ plain: true }) as Record<string, unknown>;
      const parentComment = plainComment.parentComment as { user?: { name?: string } } | undefined;
      return {
        id: plainComment.id,
        comment: plainComment.comment,
        postid: plainComment.postid,
        createdby: plainComment.createdby,
        createdat: plainComment.createdat,
        parentCommentId: plainComment.parentCommentId,
        user: plainComment.user,
        replyingTo: parentComment?.user?.name ?? null,
      };
    });

    res.status(200).json({ comments: transformedComments, total: transformedComments.length });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const searchPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchQuery = (req.query.q as string) || '';

    const posts = await Post.findAll({
      where: { showpost: true, title: { [Op.iLike]: `%${searchQuery}%` } },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'profilepic'],
          where: { isDeleted: false },
        },
      ],
      order: [['postedtime', 'DESC']],
    });

    res.status(200).json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
