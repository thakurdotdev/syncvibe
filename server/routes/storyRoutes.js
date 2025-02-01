const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const fileHandleMiddleware = require("../middleware/fileHandleMiddleware");
const {
  createStory,
  viewStories,
  getUserStories,
  getFeedStories,
  markStoriesAsViewed,
} = require("../controllers/story/story");

const storyRoutes = express.Router();

storyRoutes
  .route("/story/create")
  .post(authMiddleware, fileHandleMiddleware.single("file"), createStory);

storyRoutes.route("/story/view/:createdby").get(authMiddleware, viewStories);
storyRoutes.route("/story/feed").get(authMiddleware, getFeedStories);

storyRoutes.route("/story/:userid").get(authMiddleware, getUserStories);

storyRoutes.route("/story/viewed").post(authMiddleware, markStoriesAsViewed);

module.exports = storyRoutes;
