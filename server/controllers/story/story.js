const { Op, Sequelize } = require('sequelize');
const User = require('../../models/auth/userModel');
const Story = require('../../models/Story/StoryModal');
const Cloudinary = require('cloudinary').v2;
const getDataUri = require('../../utils/dataUri');
const sequelize = require('../../utils/sequelize');

const validateStoryMedia = (file) => {
  if (!file) {
    throw {
      status: 400,
      message: 'Media file is required for creating a story',
      code: 'VALIDATION_ERROR',
    };
  }

  // Check file type and size
  const isVideo = file.mimetype.startsWith('video');
  const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024; // 30MB for videos, 5MB for images

  if (file.size > maxSize) {
    throw {
      status: 400,
      message: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
      code: 'VALIDATION_ERROR',
    };
  }

  if (isVideo) {
    // Additional video duration check will be handled by Cloudinary
    return 'video';
  }
  return 'image';
};

const processStoryMedia = async (file, mediaType) => {
  try {
    const dataUri = getDataUri(file);
    const uploadOptions = {
      folder: 'stories',
      quality: 'auto:good',
      fetch_format: 'auto',
      resource_type: mediaType,
    };

    if (mediaType === 'video') {
      uploadOptions.duration = 30; // Limit video duration to 30 seconds
      uploadOptions.transformation = [
        { duration: '30.0' }, // Trim video to 30 seconds if longer
      ];
    }

    const result = await Cloudinary.uploader.upload(dataUri.content, uploadOptions);
    return result.secure_url;
  } catch (error) {
    throw {
      status: 500,
      message: 'Error uploading media',
      code: 'UPLOAD_ERROR',
    };
  }
};

const createStory = async (req, res) => {
  try {
    const { userid: createdby } = req.user;
    const file = req.file;
    const { textOverlays } = req.body;
    // Validate media
    const mediaType = validateStoryMedia(file);

    // Process media
    const mediaUrl = await processStoryMedia(file, mediaType);

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create story
    const story = await Story.create({
      createdby,
      mediaUrl,
      mediaType,
      expiresAt,
      views: [],
      content: textOverlays,
    });

    return res.status(200).json({
      message: 'Story created successfully',
      story,
    });
  } catch (error) {
    console.error('Story creation error:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Internal server error',
      code: error.code,
    });
  }
};

// controllers/story/viewStories.js
const viewStories = async (req, res) => {
  try {
    const { userid } = req.user;
    const { createdby } = req.params;

    // Get all active stories for the user
    const stories = await Story.findAll({
      where: {
        createdby,
        expiresAt: {
          [Op.gt]: new Date(), // Only get unexpired stories
        },
      },
      order: [['postedtime', 'DESC']],
    });

    // Update views for stories that haven't been viewed by this user
    const updatedStories = await Promise.all(
      stories.map(async (story) => {
        if (!story.views.includes(userid)) {
          story.views = [...story.views, userid];
          await story.save();
        }
        return story;
      })
    );

    return res.status(200).json({
      message: 'success',
      stories: updatedStories,
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

const getUserStories = async (req, res) => {
  try {
    const { userid: viewerId } = req.user;
    const { userid: creatorId } = req.params;

    const stories = await Story.findAll({
      where: {
        createdby: creatorId,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
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
          attributes: ['userid', 'username', 'profilepic', 'name'],
        },
      ],
      order: [['postedtime', 'ASC']],
    });

    if (stories.length > 0) {
      await Promise.all(
        stories.map(async (story) => {
          console.log(story.views, viewerId);

          if (!story.views.includes(viewerId)) {
            await Story.update(
              {
                views: Sequelize.fn('array_append', Sequelize.col('views'), viewerId),
              },
              {
                where: { storyid: story.storyid },
              }
            );
          }
        })
      );
    }

    return res.status(200).json({
      message: 'success',
      stories,
    });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

const getFeedStories = async (req, res) => {
  try {
    const { userid } = req.user;

    // Get the user and their following relationships
    const user = await User.findOne({
      where: { userid },
      include: [
        {
          model: User,
          as: 'followingUsers', // Ensure the alias is correct
          attributes: ['userid'],
          through: { attributes: [] }, // This prevents including the join table fields
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Get IDs of users the current user follows, plus their own ID
    const followingIds = user.followingUsers.map((following) => following.userid);
    followingIds.push(userid); // Include the user's own ID

    // Get all unexpired stories from followed users
    const stories = await Story.findAll({
      where: {
        createdby: {
          [Op.in]: followingIds,
        },
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
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
          as: 'user', // Ensure the alias is correct for the user who posted the story
          attributes: ['userid', 'username', 'profilepic', 'name', 'verified'],
        },
      ],
      order: [
        ['createdby', 'ASC'],
        ['postedtime', 'ASC'],
      ],
    });

    // Group stories by user
    const storiesMap = new Map();
    stories.forEach((story) => {
      if (!storiesMap.has(story.user.userid)) {
        storiesMap.set(story.user.userid, {
          user: story.user,
          stories: [],
          hasUnviewedStories: false,
        });
      }
      const userStories = storiesMap.get(story.user.userid);
      const storyObj = story.get({ plain: true });
      storyObj.isViewed = story.views.includes(userid);
      userStories.stories.push(storyObj);

      // If any story is unviewed, mark the user as having unviewed stories
      if (!storyObj.isViewed) {
        userStories.hasUnviewedStories = true;
      }
    });

    // Convert map to array and sort users with unviewed stories first
    const groupedStories = Array.from(storiesMap.values()).sort((a, b) => {
      // Sort by unviewed stories first, then by most recent story
      if (a.hasUnviewedStories !== b.hasUnviewedStories) {
        return b.hasUnviewedStories ? 1 : -1;
      }
      return b.stories[0].postedtime - a.stories[0].postedtime;
    });

    return res.status(200).json({
      message: 'success',
      stories: groupedStories,
    });
  } catch (error) {
    console.error('Error fetching feed stories:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

const markStoriesAsViewed = async (req, res) => {
  try {
    const { userid: viewerId } = req.user;
    const { storyIds } = req.body;

    if (!Array.isArray(storyIds)) {
      return res.status(400).json({
        message: 'Invalid request format',
        code: 'INVALID_REQUEST',
      });
    }

    const allStories = await Story.findAll({
      where: {
        storyid: {
          [Op.in]: storyIds,
        },
      },
    });

    const filteredStories = allStories.filter((story) => !story.views.includes(viewerId));

    // Update views for all found stories
    await Promise.all(
      filteredStories.map((story) =>
        Story.update(
          {
            views: Sequelize.fn('array_append', Sequelize.col('views'), viewerId),
          },
          {
            where: { storyid: story.storyid },
          }
        )
      )
    );

    return res.status(200).json({
      message: 'Stories marked as viewed successfully',
      updatedStories: filteredStories.length,
    });
  } catch (error) {
    console.error('Error marking stories as viewed:', error);
    return res.status(500).json({
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

module.exports = {
  createStory,
  viewStories,
  getUserStories,
  markStoriesAsViewed,
  getFeedStories,
};
