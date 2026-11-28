/**
 * A 'gif' carries its picture as an image attachment, and a 'song' has its name and artists as
 * its text, so app versions from before them still show something.
 */
export type MessageType = 'text' | 'image' | 'file' | 'call' | 'gif' | 'song';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

/**
 * A file in the private chat bucket. Its links are signed for the conversation's members and
 * stay the same, and valid, for at least six hours; after `expiresAt` a device asks for new ones
 * (GET /api/chat/attachments/:id).
 */
export interface FileAttachmentDto {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number;
  /** Shows or plays it. For files a browser can't show, the same as `downloadUrl`. */
  url: string | null;
  /** Saves it under its name. */
  downloadUrl: string | null;
  expiresAt: string | null;
}

/** A photo sent before files moved to R2, on a public Cloudinary address. */
export interface LegacyPhotoDto {
  kind: 'image';
  url: string;
  width?: number;
  height?: number;
}

export type AttachmentDto = FileAttachmentDto | LegacyPhotoDto;

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
  attachmentKind: AttachmentKind | null;
  attachmentName: string | null;
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
  /** A shared song: the catalog's copy, which devices play as it is. */
  song: Record<string, unknown> | null;
  /** Forwarded from another conversation: shown as such, and can't be edited. */
  forwarded: boolean;
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
  /** You muted it: no notifications from it on your devices. */
  muted: boolean;
  /** You blocked the other person. Whether they blocked you isn't said. */
  blocked: boolean;
}

export interface ReceiptDto {
  conversationId: number;
  userId: number;
  lastReadMessageId: number;
  lastReadAt: string | null;
  lastDeliveredMessageId: number;
}
