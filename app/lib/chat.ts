import * as Crypto from 'expo-crypto';
import type { Socket } from 'socket.io-client';
import {
  useChatStore,
  type ChatMessage,
  type Conversation,
  type MessagePage,
  type Receipt,
} from '@/stores/chatStore';
import { uploadImageToCloudinary } from '@/utils/Cloudinary';
import { api } from '@/utils/hooks/useApi';

/**
 * Direct messages, talking to the server. Reading goes over HTTP; everything the user does goes
 * over the socket as a command that the server always answers; what happens elsewhere arrives as
 * socket events (the protocol is described in server/src/socket/chat.ts). All of it ends up in
 * the chat store, which is what screens read. The web has the same file in client/src/lib/chat.js.
 */

export const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 40;
const COMMAND_TIMEOUT_MS = 12000;
/** "Typing…" is repeated this often while the user keeps typing, and expires a little later. */
const TYPING_REPEAT_MS = 3000;
const TYPING_EXPIRES_MS = 5000;

const store = () => useChatStore.getState();

let socket: Socket | null = null;

export class ChatError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const command = async <T extends object>(event: string, payload: object): Promise<T> => {
  if (!socket?.connected) throw new ChatError('OFFLINE', "You're offline");
  let reply: ({ ok: boolean; code?: string; message?: string } & T) | undefined;
  try {
    reply = await socket.timeout(COMMAND_TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    throw new ChatError('TIMEOUT', 'No answer from the server');
  }
  if (!reply?.ok) {
    throw new ChatError(reply?.code || 'INTERNAL', reply?.message || 'Something went wrong');
  }
  return reply;
};

// ── Conversations ───────────────────────────────────────────────────────────

let conversationsRequest: Promise<void> | null = null;

/** One request at a time: a second caller waits for the one already on its way. */
export const refreshConversations = (): Promise<void> => {
  conversationsRequest ??= api
    .get<{ conversations: Conversation[] }>('/api/chat/conversations')
    .then(({ data }) => store().setConversations(data.conversations))
    .catch((error) => console.error('Loading conversations failed:', error))
    .finally(() => {
      conversationsRequest = null;
    });
  return conversationsRequest;
};

/** The conversation with a person, created on the server if it is the first time. */
export const openConversationWith = async (userId: number | string): Promise<Conversation> => {
  const { data } = await api.post<{ conversation: Conversation }>('/api/chat/conversations', {
    userId: Number(userId),
  });
  store().upsertConversation(data.conversation);
  return data.conversation;
};

// ── Messages ────────────────────────────────────────────────────────────────

export const loadThread = async (conversationId: number): Promise<void> => {
  const thread = store().threads[conversationId];
  if (thread?.status === 'loading') return;
  // Reloading keeps what's on screen; only a first load shows a placeholder.
  store().setThreadStatus(conversationId, {
    status: thread?.status === 'ready' ? 'ready' : 'loading',
  });
  try {
    const { data } = await api.get<MessagePage>(
      `/api/chat/conversations/${conversationId}/messages`,
      { params: { limit: PAGE_SIZE } }
    );
    store().setLatestPage(conversationId, data);
  } catch (error) {
    console.error('Loading messages failed:', error);
    if (store().threads[conversationId]?.status !== 'ready') {
      store().setThreadStatus(conversationId, { status: 'error' });
    }
  }
};

export const loadOlder = async (conversationId: number): Promise<void> => {
  const thread = store().threads[conversationId];
  const oldest = thread?.messages.find((m) => m.id != null);
  if (!thread || thread.status !== 'ready' || !thread.hasMore || thread.loadingOlder || !oldest) {
    return;
  }
  store().setThreadStatus(conversationId, { loadingOlder: true });
  try {
    const { data } = await api.get<MessagePage>(
      `/api/chat/conversations/${conversationId}/messages`,
      { params: { limit: PAGE_SIZE, before: oldest.id } }
    );
    store().addOlderPage(conversationId, data);
  } catch (error) {
    console.error('Loading older messages failed:', error);
    store().setThreadStatus(conversationId, { loadingOlder: false });
  }
};

// ── Sending ─────────────────────────────────────────────────────────────────

export interface PickedPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
}

interface Draft {
  body: string | null;
  photo?: PickedPhoto;
  attachment?: { url: string; width?: number; height?: number };
  replyToId: number | null;
}

/** What a message being sent still needs, by clientId: its photo, and the upload once it's done. */
const drafts = new Map<string, Draft>();
const inFlight = new Set<string>();

const deliver = async (conversationId: number, clientId: string): Promise<void> => {
  const draft = drafts.get(clientId);
  if (!draft || inFlight.has(clientId)) return;
  inFlight.add(clientId);
  store().setPendingStatus(conversationId, clientId, 'sending');

  try {
    if (draft.photo && !draft.attachment) {
      draft.attachment = await uploadImageToCloudinary(
        api,
        draft.photo.uri,
        draft.photo.fileName || 'image.jpg',
        draft.photo.mimeType || 'image/jpeg',
        'chat'
      );
    }
    const { message } = await command<{ message: ChatMessage }>('chat:send', {
      conversationId,
      clientId,
      body: draft.body,
      attachment: draft.attachment ?? null,
      replyToId: draft.replyToId,
    });
    drafts.delete(clientId);
    store().receiveMessage(message);
  } catch (error) {
    const code = error instanceof ChatError ? error.code : 'UPLOAD';
    // Offline: it stays "sending" and goes out by itself when the connection is back. The server
    // stores a clientId once, so sending it again can't make a second copy.
    if (code !== 'OFFLINE') {
      const refused = error instanceof ChatError && code !== 'TIMEOUT';
      store().setPendingStatus(
        conversationId,
        clientId,
        'failed',
        refused ? (error as ChatError).message : null
      );
    }
  } finally {
    inFlight.delete(clientId);
  }
};

export const sendMessage = (
  conversationId: number,
  input: { body?: string; photo?: PickedPhoto | null; replyTo?: ChatMessage | null }
): void => {
  const text = input.body?.trim() || null;
  const photo = input.photo ?? undefined;
  const meId = store().meId;
  if ((!text && !photo) || meId == null) return;

  const clientId = Crypto.randomUUID();
  const replyTo = input.replyTo;
  drafts.set(clientId, { body: text, photo, replyToId: replyTo?.id ?? null });

  store().addPending({
    id: null,
    clientId,
    conversationId,
    senderId: meId,
    type: photo ? 'image' : 'text',
    body: text,
    attachment: photo ? { url: photo.uri, width: photo.width, height: photo.height } : null,
    localUrl: photo?.uri,
    call: null,
    replyTo:
      replyTo && replyTo.id != null
        ? {
            id: replyTo.id,
            senderId: replyTo.senderId,
            type: replyTo.type,
            body: replyTo.body,
            hasAttachment: Boolean(replyTo.attachment),
            deleted: false,
          }
        : null,
    reactions: [],
    editedAt: null,
    createdAt: new Date().toISOString(),
    status: 'sending',
  });
  setTyping(conversationId, false);
  void deliver(conversationId, clientId);
};

export const retryMessage = (message: ChatMessage) =>
  deliver(message.conversationId, message.clientId);

export const discardMessage = (message: ChatMessage): void => {
  drafts.delete(message.clientId);
  store().removePending(message.conversationId, message.clientId);
};

const flushOutbox = (): void => {
  for (const [conversationId, thread] of Object.entries(store().threads)) {
    for (const message of thread.messages) {
      if (message.id == null && message.status === 'sending') {
        void deliver(Number(conversationId), message.clientId);
      }
    }
  }
};

/**
 * Sends without a socket, for a reply typed into a notification while the app is in the
 * background. The socket event still reaches every open device.
 */
export const sendOverHttp = async (conversationId: number, body: string): Promise<void> => {
  const { data } = await api.post<{ message: ChatMessage }>(
    `/api/chat/conversations/${conversationId}/messages`,
    { clientId: Crypto.randomUUID(), body }
  );
  store().receiveMessage(data.message);
};

// ── Changing messages ───────────────────────────────────────────────────────

export const editMessage = async (message: ChatMessage, body: string): Promise<void> => {
  const { message: updated } = await command<{ message: ChatMessage }>('chat:edit', {
    messageId: message.id,
    body,
  });
  store().updateMessage(updated);
};

// Everyone in the conversation, this device included, hears about it through an event that also
// carries the conversation's new last message. That event is what removes it from the screen.
export const deleteMessage = (message: ChatMessage) =>
  command('chat:delete', { messageId: message.id });

/** Sets the reaction, or removes it when it is the one already chosen. */
export const toggleReaction = async (message: ChatMessage, emoji: string): Promise<void> => {
  const meId = store().meId;
  const mine = message.reactions.find((r) => meId != null && r.userIds.includes(meId))?.emoji;
  const { message: updated } = await command<{ message: ChatMessage }>('chat:react', {
    messageId: message.id,
    emoji: mine === emoji ? null : emoji,
  });
  store().updateMessage(updated);
};

// ── Read receipts and typing ────────────────────────────────────────────────

/** Tells the server the user has seen the conversation up to its last message from the other person. */
export const markRead = (conversationId: number): void => {
  const state = store();
  const conversation = state.conversations.find((c) => c.id === conversationId);
  const thread = state.threads[conversationId];
  if (!conversation || !thread || state.meId == null) return;

  let lastSeen: ChatMessage | undefined;
  for (let i = thread.messages.length - 1; i >= 0 && !lastSeen; i--) {
    const message = thread.messages[i];
    if (message.id != null && message.senderId !== state.meId) lastSeen = message;
  }
  if (!lastSeen?.id || lastSeen.id <= conversation.myLastReadMessageId) return;

  state.applyReceipt({
    conversationId,
    userId: state.meId,
    lastReadMessageId: lastSeen.id,
    lastReadAt: new Date().toISOString(),
    lastDeliveredMessageId: lastSeen.id,
  });
  // If this is lost, the next message or the next time the conversation opens sends it again.
  command('chat:read', { conversationId, messageId: lastSeen.id }).catch(() => {});
};

const typingSent = new Map<number, number>();

export const setTyping = (conversationId: number, typing: boolean): void => {
  if (!socket?.connected) return;
  const last = typingSent.get(conversationId) ?? 0;
  if (typing) {
    if (Date.now() - last < TYPING_REPEAT_MS) return;
    typingSent.set(conversationId, Date.now());
  } else {
    if (!last) return;
    typingSent.delete(conversationId);
  }
  socket.emit('chat:typing', { conversationId, typing });
};

// ── Socket ──────────────────────────────────────────────────────────────────

/**
 * Starts listening on a connected-or-connecting socket. `onIncoming` is called for each new
 * message from someone else. Returns a function that stops listening.
 */
export const bindChatSocket = (
  nextSocket: Socket,
  options: { userId: number; onIncoming?: (message: ChatMessage) => void }
): (() => void) => {
  const { userId, onIncoming } = options;
  socket = nextSocket;
  store().setMe(userId);

  const typingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const clearTypingTimer = (conversationId: number) => {
    const timer = typingTimers.get(conversationId);
    if (timer) clearTimeout(timer);
    typingTimers.delete(conversationId);
  };

  const onMessage = (payload?: { message?: ChatMessage }, confirm?: unknown) => {
    // Tells the server a device has it: the sender's tick turns into two.
    if (typeof confirm === 'function') confirm();
    const message = payload?.message;
    if (!message) return;

    const known = store().receiveMessage(message);
    if (!known) void refreshConversations();
    if (message.senderId !== userId) {
      clearTypingTimer(message.conversationId);
      onIncoming?.(message);
    }
  };

  const onUpdated = (payload?: { message?: ChatMessage }) => {
    if (payload?.message) store().updateMessage(payload.message);
  };
  const onDeleted = (payload?: {
    conversationId: number;
    messageId: number;
    lastMessage: ChatMessage | null;
  }) => {
    if (payload) store().removeMessage(payload);
  };
  const onReceipt = (receipt?: Receipt) => {
    if (receipt) store().applyReceipt(receipt);
  };
  const onPresence = (payload?: { userId: number; online: boolean }) => {
    if (payload) store().setPresence(payload.userId, payload.online);
  };

  const onTyping = (payload?: { conversationId?: number; typing?: boolean }) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;
    clearTypingTimer(conversationId);
    store().setTyping(conversationId, Boolean(payload?.typing));
    if (payload?.typing) {
      typingTimers.set(
        conversationId,
        setTimeout(() => store().setTyping(conversationId, false), TYPING_EXPIRES_MS)
      );
    }
  };

  // On every connection, the first included: events may have been missed while it was down.
  const onConnect = () => {
    typingSent.clear();
    void refreshConversations();
    const { activeId } = store();
    if (activeId) void loadThread(activeId);
    flushOutbox();
  };

  const listeners: Record<string, (...args: any[]) => void> = {
    connect: onConnect,
    'chat:message': onMessage,
    'chat:message:updated': onUpdated,
    'chat:message:deleted': onDeleted,
    'chat:receipt': onReceipt,
    'chat:typing': onTyping,
    'presence:update': onPresence,
  };
  for (const [event, listener] of Object.entries(listeners)) nextSocket.on(event, listener);

  // The list shouldn't wait for the socket, which may be slow to connect or blocked.
  void refreshConversations();
  if (nextSocket.connected) onConnect();

  return () => {
    for (const [event, listener] of Object.entries(listeners)) nextSocket.off(event, listener);
    typingTimers.forEach(clearTimeout);
    if (socket === nextSocket) socket = null;
  };
};

/** On sign-out: nothing of the last user's conversations stays in memory. */
export const resetChat = (): void => {
  drafts.clear();
  inFlight.clear();
  typingSent.clear();
  store().reset();
};
