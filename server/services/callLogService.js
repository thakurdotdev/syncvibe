const { Op } = require("sequelize");
const ChatMessage = require("../models/chat/chatMessageModel");
const Chat = require("../models/chat/chatModel");

const CALL_DISPLAY = {
  missed_call: "Missed call",
  completed_call: "Video call",
  rejected_call: "Declined call",
};

const findChatByParticipants = async (userId1, userId2) => {
  const participants = [parseInt(userId1, 10), parseInt(userId2, 10)].sort(
    (a, b) => a - b
  );

  return Chat.findOne({
    where: {
      participants: { [Op.contains]: participants },
    },
  });
};

const saveCallEvent = async ({
  callerId,
  receiverId,
  messagetype,
  duration,
}) => {
  try {
    const chat = await findChatByParticipants(callerId, receiverId);
    if (!chat) return null;

    const message = await ChatMessage.create({
      chatid: chat.chatid,
      senderid: callerId,
      content: duration ? String(duration) : null,
      messagetype,
      isread: false,
    });

    const displayText = CALL_DISPLAY[messagetype] || "Call";
    await Chat.update(
      {
        lastmessage: displayText,
        lastmessageType: "call",
        updatedat: new Date(),
      },
      { where: { chatid: chat.chatid } }
    );

    return {
      messageid: message.messageid,
      chatid: chat.chatid,
      senderid: callerId,
      content: message.content,
      messagetype,
      createdat: message.createdat,
      isread: false,
    };
  } catch (error) {
    console.error("Failed to save call event:", error);
    return null;
  }
};

module.exports = { saveCallEvent };
