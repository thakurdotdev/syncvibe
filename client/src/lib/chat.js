import axios from 'axios';
import { useChatStore } from '@/stores/chatStore';
import { uploadToCloudinary } from '@/Utils/cloudinaryUpload';

/**
 * Direct messages, talking to the server. Reading goes over HTTP; everything the user does goes
 * over the socket as a command that the server always answers; what happens elsewhere arrives as
 * socket events (the protocol is described in server/src/socket/chat.ts). All of it ends up in
 * the chat store, which is what screens read.
 */

export const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 40;
const COMMAND_TIMEOUT_MS = 12000;
/** "Typing…" is repeated this often while the user keeps typing, and expires a little later. */
const TYPING_REPEAT_MS = 3000;
const TYPING_EXPIRES_MS = 5000;

const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/chat`,
  withCredentials: true,
});

const store = () => useChatStore.getState();

let socket = null;

export class ChatError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Whether trying again later could work, as opposed to the server having said no. */
const isTemporary = (error) => error.code === 'OFFLINE' || error.code === 'TIMEOUT';

const command = async (event, payload) => {
  if (!socket?.connected) throw new ChatError('OFFLINE', "You're offline");
  let reply;
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

export const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;

// ── Conversations ───────────────────────────────────────────────────────────

let conversationsRequest = null;

/** One request at a time: a second caller waits for the one already on its way. */
export const refreshConversations = () => {
  conversationsRequest ??= http
    .get('/conversations')
    .then(({ data }) => store().setConversations(data.conversations))
    .catch((error) => console.error('Loading conversations failed:', error))
    .finally(() => {
      conversationsRequest = null;
    });
  return conversationsRequest;
};

/** The conversation with a person, created on the server if it is the first time. */
export const openConversationWith = async (userId) => {
  const { data } = await http.post('/conversations', { userId });
  store().upsertConversation(data.conversation);
  return data.conversation;
};

// ── Messages ────────────────────────────────────────────────────────────────

export const loadThread = async (conversationId) => {
  const thread = store().threads[conversationId];
  if (thread?.status === 'loading') return;
  // Reloading keeps what's on screen; only a first load shows a placeholder.
  store().setThreadStatus(conversationId, {
    status: thread?.status === 'ready' ? 'ready' : 'loading',
  });
  try {
    const { data } = await http.get(`/conversations/${conversationId}/messages`, {
      params: { limit: PAGE_SIZE },
    });
    store().setLatestPage(conversationId, data);
  } catch (error) {
    console.error('Loading messages failed:', error);
    if (store().threads[conversationId]?.status !== 'ready') {
      store().setThreadStatus(conversationId, { status: 'error' });
    }
  }
};

export const loadOlder = async (conversationId) => {
  const thread = store().threads[conversationId];
  const oldest = thread?.messages.find((m) => m.id != null);
  if (!thread || thread.status !== 'ready' || !thread.hasMore || thread.loadingOlder || !oldest) {
    return;
  }
  store().setThreadStatus(conversationId, { loadingOlder: true });
  try {
    const { data } = await http.get(`/conversations/${conversationId}/messages`, {
      params: { limit: PAGE_SIZE, before: oldest.id },
    });
    store().addOlderPage(conversationId, data);
  } catch (error) {
    console.error('Loading older messages failed:', error);
    store().setThreadStatus(conversationId, { loadingOlder: false });
  }
};

// ── Sending ─────────────────────────────────────────────────────────────────

/** What a message being sent still needs, by clientId: its file, and the upload once it's done. */
const drafts = new Map();
const inFlight = new Set();

const deliver = async (conversationId, clientId) => {
  const draft = drafts.get(clientId);
  if (!draft || inFlight.has(clientId)) return;
  inFlight.add(clientId);
  store().setPendingStatus(conversationId, clientId, 'sending');

  try {
    if (draft.file && !draft.attachment) {
      const uploaded = await uploadToCloudinary(draft.file, 'chat');
      draft.attachment = { url: uploaded.image, width: uploaded.width, height: uploaded.height };
    }
    const { message } = await command('chat:send', {
      conversationId,
      clientId,
      body: draft.body,
      attachment: draft.attachment ?? null,
      replyToId: draft.replyToId,
    });
    drafts.delete(clientId);
    store().receiveMessage(message);
  } catch (error) {
    // Offline: it stays "sending" and goes out by itself when the connection is back. The server
    // stores a clientId once, so sending it again can't make a second copy.
    if (error.code !== 'OFFLINE') {
      store().setPendingStatus(
        conversationId,
        clientId,
        'failed',
        isTemporary(error) || !(error instanceof ChatError) ? null : error.message
      );
    }
  } finally {
    inFlight.delete(clientId);
  }
};

export const sendMessage = (conversationId, { body, file, replyTo }) => {
  const text = body?.trim() || null;
  if (!text && !file) return;

  const clientId = newClientId();
  const localUrl = file ? URL.createObjectURL(file) : undefined;
  drafts.set(clientId, { body: text, file, replyToId: replyTo?.id ?? null });

  store().addPending({
    id: null,
    clientId,
    conversationId,
    senderId: store().meId,
    type: file ? 'image' : 'text',
    body: text,
    attachment: file ? { url: localUrl } : null,
    localUrl,
    call: null,
    replyTo: replyTo
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

export const retryMessage = (message) => deliver(message.conversationId, message.clientId);

export const discardMessage = (message) => {
  drafts.delete(message.clientId);
  store().removePending(message.conversationId, message.clientId);
};

const flushOutbox = () => {
  for (const [conversationId, thread] of Object.entries(store().threads)) {
    for (const message of thread.messages) {
      if (message.id == null && message.status === 'sending') {
        void deliver(Number(conversationId), message.clientId);
      }
    }
  }
};

// ── Changing messages ───────────────────────────────────────────────────────

export const editMessage = async (message, body) => {
  const { message: updated } = await command('chat:edit', { messageId: message.id, body });
  store().updateMessage(updated);
};

// Everyone in the conversation, this device included, hears about it through an event that also
// carries the conversation's new last message. That event is what removes it from the screen.
export const deleteMessage = (message) => command('chat:delete', { messageId: message.id });

/** Sets the reaction, or removes it when it is the one already chosen. */
export const toggleReaction = async (message, emoji) => {
  const meId = store().meId;
  const mine = message.reactions.find((r) => r.userIds.includes(meId))?.emoji;
  const { message: updated } = await command('chat:react', {
    messageId: message.id,
    emoji: mine === emoji ? null : emoji,
  });
  store().updateMessage(updated);
};

// ── Read receipts and typing ────────────────────────────────────────────────

/** Tells the server the user has seen the conversation up to its last message from the other person. */
export const markRead = (conversationId) => {
  const state = store();
  const conversation = state.conversations.find((c) => c.id === conversationId);
  const thread = state.threads[conversationId];
  if (!conversation || !thread) return;

  const lastSeen = thread.messages.findLast((m) => m.id != null && m.senderId !== state.meId);
  if (!lastSeen || lastSeen.id <= conversation.myLastReadMessageId) return;

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

const typingSent = new Map();

export const setTyping = (conversationId, typing) => {
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
export const bindChatSocket = (nextSocket, { userId, onIncoming }) => {
  socket = nextSocket;
  store().setMe(userId);

  const typingTimers = new Map();
  const clearTypingTimer = (conversationId) => {
    clearTimeout(typingTimers.get(conversationId));
    typingTimers.delete(conversationId);
  };

  const onMessage = (payload, confirm) => {
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

  const onUpdated = (payload) => payload?.message && store().updateMessage(payload.message);
  const onDeleted = (payload) => payload && store().removeMessage(payload);
  const onReceipt = (receipt) => receipt && store().applyReceipt(receipt);
  const onPresence = (payload) => payload && store().setPresence(payload.userId, payload.online);

  const onTyping = ({ conversationId, typing } = {}) => {
    if (!conversationId) return;
    clearTypingTimer(conversationId);
    store().setTyping(conversationId, Boolean(typing));
    if (typing) {
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

  const listeners = {
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
export const resetChat = () => {
  drafts.clear();
  inFlight.clear();
  typingSent.clear();
  store().reset();
};
