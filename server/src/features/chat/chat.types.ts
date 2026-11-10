export type MessageType = 'text' | 'image' | 'call';

export interface AttachmentDto {
  url: string;
  width?: number;
  height?: number;
}

export interface CallDto {
  outcome: 'missed' | 'completed' | 'rejected';
  durationSec?: number;
}

export interface ReplyPreviewDto {
  id: number;
  senderId: number;
  type: MessageType;
  body: string | null;
  hasAttachment: boolean;
  deleted: boolean;
}

export interface ReactionDto {
  emoji: string;
  userIds: number[];
}

export interface MessageDto {
  id: number;
  conversationId: number;
  senderId: number;
  /** The id the sending device gave it, so that device can match it to what it's showing. */
  clientId: string;
  type: MessageType;
  body: string | null;
  attachment: AttachmentDto | null;
  call: CallDto | null;
  replyTo: ReplyPreviewDto | null;
  reactions: ReactionDto[];
  editedAt: string | null;
  createdAt: string;
}

export interface PeerDto {
  userid: number;
  name: string;
  username: string;
  profilepic: string | null;
  online: boolean;
}

export interface ConversationDto {
  id: number;
  peer: PeerDto;
  lastMessage: MessageDto | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  /** How far each side has read, and how far messages have reached the other person's devices. */
  myLastReadMessageId: number;
  peerLastReadMessageId: number;
  peerLastReadAt: string | null;
  peerLastDeliveredMessageId: number;
}

export interface ReceiptDto {
  conversationId: number;
  userId: number;
  lastReadMessageId: number;
  lastReadAt: string | null;
  lastDeliveredMessageId: number;
}
