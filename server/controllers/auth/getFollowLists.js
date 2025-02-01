const User = require("../../models/auth/userModel");
const Follower = require("../../models/auth/followerModel");

// Controller to get following and followers list
const getFollowLists = async (req, res) => {
  try {
    const userid = req.params.userid;

    // Validate user ID
    if (!userid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Fetch following users using the direct association
    const following = await Follower.findAll({
      where: { followerid: userid },
      attributes: ["id", "createdat"],
      include: [
        {
          model: User,
          as: "followingDetail", // Matches the alias from belongsTo
          attributes: ["userid", "name", "username", "profilepic"],
        },
      ],
      order: [["createdat", "DESC"]],
    });

    // Fetch followers using the direct association
    const followers = await Follower.findAll({
      where: { followid: userid },
      attributes: ["id", "createdat"],
      include: [
        {
          model: User,
          as: "followerDetail", // Matches the alias from belongsTo
          attributes: ["userid", "name", "username", "profilepic"],
        },
      ],
      order: [["createdat", "DESC"]],
    });

    return res.status(200).json({ following, followers });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the follow lists." });
  }
};

module.exports = { getFollowLists };
