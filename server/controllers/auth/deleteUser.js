const Follower = require("../../models/auth/followerModel");
const User = require("../../models/auth/userModel");
const ChatMessage = require("../../models/chat/chatMessageModel");
const Chat = require("../../models/chat/chatModel");
const Comment = require("../../models/post/commentModel");
const LikeDislike = require("../../models/post/likeDislikeModel");
const Post = require("../../models/post/postModel");
const { Op } = require("sequelize");
const Story = require("../../models/Story/StoryModal");
const crypto = require("crypto");
const OTP = require("../../models/auth/otpModel");
const {
  otpForDeleteMailSender,
  accountDeletedMailSender,
} = require("../../utils/resend");
const sequelize = require("../../utils/sequelize");
const Playlist = require("../../models/music/playlist");

const generateSixDigitOTP = () => {
  return crypto.randomInt(100000, 999999);
};

const getOtpForAccountDelete = async (req, res) => {
  const { userid } = req.user;

  if (req.user.role === "guest") {
    return res.status(403).json({ message: "Guset account cannot be deleted" });
  }

  try {
    const user = await User.findByPk(userid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = generateSixDigitOTP();
    await OTP.create({ email: user.email, otp });

    const sendOtp = await otpForDeleteMailSender(user.email, otp);

    if (!sendOtp) {
      return res.status(500).json({ message: "Error sending OTP" });
    }

    return res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error("Error getting OTP for delete:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteUser = async (req, res) => {
  const { userid } = req.user;
  const { otp } = req.body;

  // Uncomment if guest user deletion is restricted
  if (req.user.role === "guest") {
    return res.status(403).json({ message: "Guest account cannot be deleted" });
  }

  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(user.email, otp);

    const otpEntry = await OTP.findOne({ where: { email: user.email, otp } });

    if (!otpEntry) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const timeDifference = new Date() - otpEntry.createdat;
    if (timeDifference > 600000) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Perform deletions within the transaction
    await Follower.destroy({ where: { followerid: userid }, transaction });
    await Follower.destroy({ where: { followid: userid }, transaction });
    await ChatMessage.destroy({ where: { senderid: userid }, transaction });
    await Comment.destroy({ where: { createdby: userid }, transaction });
    await LikeDislike.destroy({ where: { userid: userid }, transaction });
    await Post.destroy({ where: { createdby: userid }, transaction });
    await Story.destroy({ where: { createdby: userid }, transaction });
    await OTP.destroy({ where: { email: user.email }, transaction });
    await Playlist.destroy({ where: { userId: userid }, transaction });
    // await PlaylistSong.destroy({ where: { userId: userid }, transaction });

    await Chat.destroy({
      where: {
        participants: {
          [Op.contains]: [userid],
        },
      },
      transaction,
    });

    await User.destroy({ where: { userid }, transaction });

    // Commit transaction
    await transaction.commit();

    await accountDeletedMailSender(user.email);

    return res.status(200).json({ message: "Success" });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getOtpForAccountDelete,
  deleteUser,
};
