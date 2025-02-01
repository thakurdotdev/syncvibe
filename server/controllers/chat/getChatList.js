const User = require("../../models/auth/userModel");
const Chat = require("../../models/chat/chatModel");

const getChatList = async (req, res) => {
  try {
    const userid = req.user.userid;

    if (!userid) {
      return res.status(400).json({ message: "Userid is required" });
    }

    // Use the new class method to find chats
    const chats = await Chat.findByParticipant(userid);

    const chatList = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.participants.find((id) => id !== userid);
        const otherUser = await User.findOne({
          where: { userid: otherUserId },
        });

        return {
          ...chat.dataValues,
          otherUser: {
            userid: otherUser.userid,
            username: otherUser.username,
            name: otherUser.name,
            profilepic: otherUser.profilepic,
          },
        };
      }),
    );

    return res.status(200).json({ message: "success", chatList: chatList });
  } catch (error) {
    console.error("Error in getChatList:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching chats." });
  }
};

module.exports = getChatList;
