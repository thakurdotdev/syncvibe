import type { Request, Response } from 'express';
import { Op, fn, col } from 'sequelize';
import { Story, User, StoryMusic } from '@/models/index';

const validateStoryMedia = (mediaUrl: string | undefined, mediaType: string | undefined): void => {
  if (!mediaUrl) {
    throw {
      status: 400,
      message: 'Media URL is required for creating a story',
      code: 'VALIDATION_ERROR',
    };
  }
  if (!mediaUrl.includes('cloudinary.com')) {
    throw {
      status: 400,
      message: 'Invalid media URL. Must be a Cloudinary URL',
      code: 'VALIDATION_ERROR',
    };
  }
  if (!mediaType || !['image', 'video'].includes(mediaType)) {
    throw {
      status: 400,
      message: "Invalid media type. Must be 'image' or 'video'",
      code: 'VALIDATION_ERROR',
    };
  }
};

export const createStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid: createdby } = req.user!;
    const { mediaUrl, mediaType, textOverlays } = req.body as {
      mediaUrl?: string;
      mediaType?: 'image' | 'video';
      textOverlays?: string;
    };

    validateStoryMedia(mediaUrl, mediaType);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      createdby,
      mediaUrl: mediaUrl!,
      mediaType: mediaType!,
      expiresAt,
      views: [],
      content: textOverlays ?? null,
    });

    res.status(200).json({ message: 'Story created successfully', story });
  } catch (error) {
    console.error('Story creation error:', error);
    const status = (error as { status?: number }).status || 500;
    res.status(status).json({
      message: (error as Error).message || 'Internal server error',
      code: (error as { code?: string }).code,
    });
  }
};

export const viewStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const createdby = req.params.createdby;

    const stories = await Story.findAll({
      where: { createdby: parseInt(String(createdby), 10), expiresAt: { [Op.gt]: new Date() } },
      order: [['postedtime', 'DESC']],
    });

    const updatedStories = await Promise.all(
      stories.map(async (story) => {
        if (!story.views.includes(userid)) {
          story.views = [...story.views, userid];
          await story.save();
        }
        return story;
      })
    );

    res.status(200).json({ message: 'success', stories: updatedStories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

export const getUserStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid: viewerId } = req.user!;
    const creatorId = req.params.userid;

    const stories = await Story.findAll({
      where: { createdby: parseInt(String(creatorId), 10), expiresAt: { [Op.gt]: new Date() } },
      attributes: [
        'storyid',
        'createdby',
        'content',
        'mediaUrl',
        'mediaType',
        'views',
        'expiresAt',
        'postedtime',
      ],
      include: [
        { model: User, as: 'user', attributes: ['userid', 'username', 'profilepic', 'name'] },
      ],
      order: [['postedtime', 'ASC']],
    });

    if (stories.length > 0) {
      await Promise.all(
        stories.map(async (story) => {
          if (!story.views.includes(viewerId)) {
            await Story.update(
              { views: fn('array_append', col('views'), viewerId) as unknown as number[] },
              { where: { storyid: story.storyid } }
            );
          }
        })
      );
    }

    res.status(200).json({ message: 'success', stories });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    res.status(500).json({ message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

export const getFeedStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;

    const user = await User.findOne({
      where: { userid },
      include: [
        { model: User, as: 'followingUsers', attributes: ['userid'], through: { attributes: [] } },
      ],
    });

    if (!user) {
      res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    const followingUsers =
      (user as unknown as { followingUsers?: Array<{ userid: number }> })?.followingUsers || [];
    const followingIds = followingUsers.map((following) => following.userid);
    followingIds.push(userid);

    const stories = await Story.findAll({
      where: { createdby: { [Op.in]: followingIds }, expiresAt: { [Op.gt]: new Date() } },
      attributes: [
        'storyid',
        'createdby',
        'content',
        'mediaUrl',
        'mediaType',
        'views',
        'expiresAt',
        'postedtime',
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['userid', 'username', 'profilepic', 'name', 'verified'],
        },
      ],
      order: [
        ['createdby', 'ASC'],
        ['postedtime', 'ASC'],
      ],
    });

    interface UserStoryGroup {
      user: unknown;
      stories: Array<Record<string, unknown>>;
      hasUnviewedStories: boolean;
    }

    const storiesMap = new Map<number, UserStoryGroup>();
    stories.forEach((story) => {
      const storyUser = (story as unknown as { user: { userid: number } }).user;
      if (!storiesMap.has(storyUser.userid)) {
        storiesMap.set(storyUser.userid, {
          user: storyUser,
          stories: [],
          hasUnviewedStories: false,
        });
      }
      const userStories = storiesMap.get(storyUser.userid)!;
      const storyObj = story.get({ plain: true }) as Record<string, unknown>;
      storyObj.isViewed = story.views.includes(userid);
      userStories.stories.push(storyObj);
      if (!storyObj.isViewed) userStories.hasUnviewedStories = true;
    });

    const groupedStories = Array.from(storiesMap.values()).sort((a, b) => {
      if (a.hasUnviewedStories !== b.hasUnviewedStories) return b.hasUnviewedStories ? 1 : -1;
      const aTime = (a.stories[0]?.postedtime as Date)?.getTime?.() ?? 0;
      const bTime = (b.stories[0]?.postedtime as Date)?.getTime?.() ?? 0;
      return bTime - aTime;
    });

    res.status(200).json({ message: 'success', stories: groupedStories });
  } catch (error) {
    console.error('Error fetching feed stories:', error);
    res.status(500).json({ message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

export const markStoriesAsViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid: viewerId } = req.user!;
    const { storyIds } = req.body as { storyIds?: number[] };

    if (!Array.isArray(storyIds)) {
      res.status(400).json({ message: 'Invalid request format', code: 'INVALID_REQUEST' });
      return;
    }

    const allStories = await Story.findAll({ where: { storyid: { [Op.in]: storyIds } } });
    const filteredStories = allStories.filter((story) => !story.views.includes(viewerId));

    await Promise.all(
      filteredStories.map((story) =>
        Story.update(
          { views: fn('array_append', col('views'), viewerId) as unknown as number[] },
          { where: { storyid: story.storyid } }
        )
      )
    );

    res.status(200).json({
      message: 'Stories marked as viewed successfully',
      updatedStories: filteredStories.length,
    });
  } catch (error) {
    console.error('Error marking stories as viewed:', error);
    res.status(500).json({ message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

export const getLatestMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const page = parseInt(req.query.page as string, 10) || 1;
    const searchQuery = req.query.searchQuery as string | undefined;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (searchQuery) {
      where.title = { [Op.iLike]: `%${searchQuery}%` };
    }

    const music = await StoryMusic.findAndCountAll({
      where,
      limit,
      offset,
      order: [['postedtime', 'DESC']],
    });

    res.status(200).json(music);
  } catch (err) {
    res.status(500).json(err);
  }
};
