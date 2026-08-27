import { Op } from 'sequelize';
import { ChatMessage, Chat } from '@/models/index';

const CALL_DISPLAY: Record<string, string> = {
  missed_call: 'Missed call',
  completed_call: 'Video call',
  rejected_call: 'Declined call',
};

interface CallEventParams {
  callerId: number;
  receiverId: number;
  messagetype: string;
  duration?: number | null;
}

interface CallEventResult {
  messageid: number;
  chatid: number;
  senderid: number;
  content: string | null;
  messagetype: string;
  createdat: Date;
  isread: boolean;
}

const findChatByParticipants = async (userId1: number | string, userId2: number | string) => {
  const participants = [Number(userId1), Number(userId2)].sort((a, b) => a - b);

  return Chat.findOne({
    where: {
      participants: { [Op.contains]: participants },
    },
  });
};

export const saveCallEvent = async ({
  callerId,
  receiverId,
  messagetype,
  duration,
}: CallEventParams): Promise<CallEventResult | null> => {
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

    const displayText = CALL_DISPLAY[messagetype] ?? 'Call';
    await Chat.update(
      {
        lastmessage: displayText,
        lastmessageType: 'call',
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
    console.error('Failed to save call event:', error);
    return null;
  }
};
