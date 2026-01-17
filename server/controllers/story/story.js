const { Op, Sequelize } = require("sequelize")
const User = require("../../models/auth/userModel")
const Story = require("../../models/Story/StoryModal")

const validateStoryMedia = (mediaUrl, mediaType) => {
  if (!mediaUrl || typeof mediaUrl !== "string") {
    throw {
      status: 400,
      message: "Media URL is required for creating a story",
      code: "VALIDATION_ERROR",
    }
  }

  if (!mediaUrl.includes("cloudinary.com")) {
    throw {
      status: 400,
      message: "Invalid media URL. Must be a Cloudinary URL",
      code: "VALIDATION_ERROR",
    }
  }

  if (!["image", "video"].includes(mediaType)) {
    throw {
      status: 400,
      message: "Invalid media type. Must be 'image' or 'video'",
      code: "VALIDATION_ERROR",
    }
  }
}

const createStory = async (req, res) => {
  try {
    const { userid: createdby } = req.user
    const { mediaUrl, mediaType, textOverlays } = req.body

    validateStoryMedia(mediaUrl, mediaType)

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const story = await Story.create({
      createdby,
      mediaUrl,
      mediaType,
      expiresAt,
      views: [],
      content: textOverlays,
    })

    return res.status(200).json({
      message: "Story created successfully",
      story,
    })
  } catch (error) {
    console.error("Story creation error:", error)
    return res.status(error.status || 500).json({
      message: error.message || "Internal server error",
      code: error.code,
    })
  }
}

const viewStories = async (req, res) => {
  try {
    const { userid } = req.user
    const { createdby } = req.params

    const stories = await Story.findAll({
      where: {
        createdby,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      order: [["postedtime", "DESC"]],
    })

    const updatedStories = await Promise.all(
      stories.map(async (story) => {
        if (!story.views.includes(userid)) {
          story.views = [...story.views, userid]
          await story.save()
        }
        return story
      }),
    )

    return res.status(200).json({
      message: "success",
      stories: updatedStories,
    })
  } catch (error) {
    console.error("Error fetching stories:", error)
    return res.status(500).json({
      message: "Internal server error",
      code: "SERVER_ERROR",
    })
  }
}

const getUserStories = async (req, res) => {
  try {
    const { userid: viewerId } = req.user
    const { userid: creatorId } = req.params

    const stories = await Story.findAll({
      where: {
        createdby: creatorId,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      attributes: [
        "storyid",
        "createdby",
        "content",
        "mediaUrl",
        "mediaType",
        "views",
        "expiresAt",
        "postedtime",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["userid", "username", "profilepic", "name"],
        },
      ],
      order: [["postedtime", "ASC"]],
    })

    if (stories.length > 0) {
      await Promise.all(
        stories.map(async (story) => {
          console.log(story.views, viewerId)

          if (!story.views.includes(viewerId)) {
            await Story.update(
              {
                views: Sequelize.fn("array_append", Sequelize.col("views"), viewerId),
              },
              {
                where: { storyid: story.storyid },
              },
            )
          }
        }),
      )
    }

    return res.status(200).json({
      message: "success",
      stories,
    })
  } catch (error) {
    console.error("Error fetching user stories:", error)
    return res.status(500).json({
      message: "Internal server error",
      code: "SERVER_ERROR",
    })
  }
}

const getFeedStories = async (req, res) => {
  try {
    const { userid } = req.user

    const user = await User.findOne({
      where: { userid },
      include: [
        {
          model: User,
          as: "followingUsers",
          attributes: ["userid"],
          through: { attributes: [] },
        },
      ],
    })

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "USER_NOT_FOUND",
      })
    }

    const followingIds = user.followingUsers.map((following) => following.userid)
    followingIds.push(userid)

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
        "storyid",
        "createdby",
        "content",
        "mediaUrl",
        "mediaType",
        "views",
        "expiresAt",
        "postedtime",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["userid", "username", "profilepic", "name", "verified"],
        },
      ],
      order: [
        ["createdby", "ASC"],
        ["postedtime", "ASC"],
      ],
    })

    const storiesMap = new Map()
    stories.forEach((story) => {
      if (!storiesMap.has(story.user.userid)) {
        storiesMap.set(story.user.userid, {
          user: story.user,
          stories: [],
          hasUnviewedStories: false,
        })
      }
      const userStories = storiesMap.get(story.user.userid)
      const storyObj = story.get({ plain: true })
      storyObj.isViewed = story.views.includes(userid)
      userStories.stories.push(storyObj)

      if (!storyObj.isViewed) {
        userStories.hasUnviewedStories = true
      }
    })

    const groupedStories = Array.from(storiesMap.values()).sort((a, b) => {
      if (a.hasUnviewedStories !== b.hasUnviewedStories) {
        return b.hasUnviewedStories ? 1 : -1
      }
      return b.stories[0].postedtime - a.stories[0].postedtime
    })

    return res.status(200).json({
      message: "success",
      stories: groupedStories,
    })
  } catch (error) {
    console.error("Error fetching feed stories:", error)
    return res.status(500).json({
      message: "Internal server error",
      code: "SERVER_ERROR",
    })
  }
}

const markStoriesAsViewed = async (req, res) => {
  try {
    const { userid: viewerId } = req.user
    const { storyIds } = req.body

    if (!Array.isArray(storyIds)) {
      return res.status(400).json({
        message: "Invalid request format",
        code: "INVALID_REQUEST",
      })
    }

    const allStories = await Story.findAll({
      where: {
        storyid: {
          [Op.in]: storyIds,
        },
      },
    })

    const filteredStories = allStories.filter((story) => !story.views.includes(viewerId))

    await Promise.all(
      filteredStories.map((story) =>
        Story.update(
          {
            views: Sequelize.fn("array_append", Sequelize.col("views"), viewerId),
          },
          {
            where: { storyid: story.storyid },
          },
        ),
      ),
    )

    return res.status(200).json({
      message: "Stories marked as viewed successfully",
      updatedStories: filteredStories.length,
    })
  } catch (error) {
    console.error("Error marking stories as viewed:", error)
    return res.status(500).json({
      message: "Internal server error",
      code: "SERVER_ERROR",
    })
  }
}

module.exports = {
  createStory,
  viewStories,
  getUserStories,
  markStoriesAsViewed,
  getFeedStories,
}
