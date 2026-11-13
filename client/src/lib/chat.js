import axios from 'axios';
import { useChatStore } from '@/stores/chatStore';
import { prepareFile } from '@/lib/attachments';

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

/**
 * What a message being sent still needs, by clientId: its text, its file and, once uploaded,
 * the upload's id. A message with a file uploads it straight to storage first, then is sent
 * naming it.
 */
const drafts = new Map();
const inFlight = new Set();

/** Progress is shown in steps, so a fast upload doesn't redraw the bubble hundreds of times. */
const PROGRESS_STEP = 0.02;

const httpError = (error, fallback) => {
  const data = error?.response?.data;
  if (data?.code) return new ChatError(data.code, data.message || fallback);
  return new ChatError(error?.response ? 'INTERNAL' : 'TIMEOUT', fallback);
};

/** Uploads the file to the address the server signed for it, reporting how far it has got. */
const putFile = (upload, file, onProgress, signal) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method || 'PUT', upload.url);
    for (const [name, value] of Object.entries(upload.headers || {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ChatError('TIMEOUT', "Couldn't upload the file"));
    xhr.onerror = () => reject(new ChatError('TIMEOUT', "Couldn't upload the file"));
    xhr.onabort = () => reject(new ChatError('CANCELLED', 'Cancelled'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });

const uploadFile = async (conversationId, clientId, draft) => {
  const { file, meta } = draft;
  let created;
  try {
    ({ data: created } = await http.post(`/conversations/${conversationId}/attachments`, {
      name: file.name,
      size: file.size,
      ...meta,
    }));
  } catch (error) {
    throw httpError(error, "Couldn't send the file");
  }
  draft.uploadId = created.attachment.id;

  let shown = 0;
  store().setUploadProgress(clientId, 0);
  await putFile(
    created.upload,
    file,
    (progress) => {
      if (progress - shown < PROGRESS_STEP && progress < 1) return;
      shown = progress;
      store().setUploadProgress(clientId, progress);
    },
    draft.abort.signal
  );
  draft.uploaded = true;
};

const deliver = async (conversationId, clientId) => {
  const draft = drafts.get(clientId);
  if (!draft || inFlight.has(clientId)) return;
  inFlight.add(clientId);
  store().setPendingStatus(conversationId, clientId, 'sending');

  const send = async () => {
    if (draft.file && !draft.uploaded) {
      if (draft.abort.signal.aborted) draft.abort = new AbortController();
      await uploadFile(conversationId, clientId, draft);
    }
    return command('chat:send', {
      conversationId,
      clientId,
      body: draft.body,
      attachmentId: draft.file ? draft.uploadId : undefined,
      replyToId: draft.replyToId,
    });
  };

  try {
    let reply;
    try {
      reply = await send();
    } catch (error) {
      // The upload ran out or was removed while waiting (offline for hours): upload it again.
      if (error.code !== 'GONE' || !draft.file) throw error;
      draft.uploaded = false;
      draft.uploadId = null;
      reply = await send();
    }
    drafts.delete(clientId);
    store().setUploadProgress(clientId, null);
    store().receiveMessage(reply.message);
  } catch (error) {
    store().setUploadProgress(clientId, null);
    if (error.code === 'CANCELLED') return;
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

const quoteOf = (replyTo) =>
  replyTo
    ? {
        id: replyTo.id,
        senderId: replyTo.senderId,
        type: replyTo.type,
        body: replyTo.body,
        hasAttachment: Boolean(replyTo.attachment),
        attachmentKind: replyTo.attachment?.kind ?? null,
        attachmentName: replyTo.attachment?.name ?? null,
        deleted: false,
      }
    : null;

const addPending = (conversationId, clientId, { body, attachment, localUrl, replyTo }) =>
  store().addPending({
    id: null,
    clientId,
    conversationId,
    senderId: store().meId,
    type: !attachment ? 'text' : attachment.kind === 'image' ? 'image' : 'file',
    body,
    attachment,
    localUrl,
    call: null,
    replyTo: quoteOf(replyTo),
    reactions: [],
    editedAt: null,
    createdAt: new Date().toISOString(),
    status: 'sending',
  });

/**
 * Sends text, files or both. Each file becomes its own message; the text goes with the first.
 * `files` are `{ file, kind }` that passed `checkFile`.
 */
export const sendMessage = async (conversationId, { body, files = [], replyTo }) => {
  let text = body?.trim() || null;
  if (!text && files.length === 0) return;
  setTyping(conversationId, false);

  if (files.length === 0) {
    const clientId = newClientId();
    drafts.set(clientId, { body: text, replyToId: replyTo?.id ?? null });
    addPending(conversationId, clientId, { body: text, attachment: null, replyTo });
    void deliver(conversationId, clientId);
    return;
  }

  // Shown at once, in order; measuring and shrinking happen while they're already on screen.
  const pending = files.map(({ file, kind }, index) => {
    const clientId = newClientId();
    const localUrl =
      kind === 'image' || kind === 'video' || kind === 'audio'
        ? URL.createObjectURL(file)
        : undefined;
    const caption = index === 0 ? text : null;
    addPending(conversationId, clientId, {
      body: caption,
      attachment: {
        kind,
        name: file.name,
        size: file.size,
        mime: file.type,
        url: localUrl ?? null,
        downloadUrl: null,
      },
      localUrl,
      replyTo: index === 0 ? replyTo : null,
    });
    return { clientId, file, kind, caption, replyToId: index === 0 ? (replyTo?.id ?? null) : null };
  });
  text = null;

  for (const item of pending) {
    const prepared = await prepareFile(item.file, item.kind);
    const { file, ...meta } = prepared;
    drafts.set(item.clientId, {
      body: item.caption,
      file,
      meta,
      replyToId: item.replyToId,
      abort: new AbortController(),
      uploadId: null,
      uploaded: false,
    });
    if (meta.width || meta.durationSec) {
      store().patchPendingAttachment(conversationId, item.clientId, {
        width: meta.width,
        height: meta.height,
        durationSec: meta.durationSec,
        size: file.size,
      });
    }
    void deliver(conversationId, item.clientId);
  }
};

export const retryMessage = (message) => deliver(message.conversationId, message.clientId);

/** Removes a message that hasn't been sent, stopping its upload and dropping what was uploaded. */
export const discardMessage = (message) => {
  const draft = drafts.get(message.clientId);
  drafts.delete(message.clientId);
  draft?.abort?.abort();
  if (draft?.uploadId) http.delete(`/attachments/${draft.uploadId}`).catch(() => {});
  store().setUploadProgress(message.clientId, null);
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

// ── Files ───────────────────────────────────────────────────────────────────

const refreshing = new Map();
const REFRESH_AGAIN_AFTER_MS = 60_000;

/**
 * New links for a file whose links ran out (a tab left open for hours). Asked at most once a
 * minute per file, so a file that really is gone doesn't make a request on every render.
 */
export const refreshAttachment = (message) => {
  const id = message?.attachment?.id;
  if (!id || message.id == null) return;
  if (Date.now() - (refreshing.get(id) ?? 0) < REFRESH_AGAIN_AFTER_MS) return;
  refreshing.set(id, Date.now());
  http
    .get(`/attachments/${id}`)
    .then(({ data }) => store().replaceAttachment(message.conversationId, data.attachment))
    .catch(() => {});
};

/** Whether a file's links are about to run out, so they're renewed before they're used. */
export const linksExpiring = (attachment) =>
  Boolean(attachment?.expiresAt) && Date.parse(attachment.expiresAt) - Date.now() < 5 * 60_000;

/** The file's links, renewed first if they're about to run out. */
export const freshAttachment = async (message) => {
  const attachment = message.attachment;
  if (!attachment?.id || !linksExpiring(attachment)) return attachment;
  const { data } = await http.get(`/attachments/${attachment.id}`);
  store().replaceAttachment(message.conversationId, data.attachment);
  return data.attachment;
};

const clickLink = (href, download) => {
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  if (download) link.download = download;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/**
 * Saves a file under its name. The download link answers "save as", so the page stays where it
 * is. Photos from before files moved to R2 have no such link and are fetched instead.
 */
export const downloadAttachment = async (message) => {
  try {
    const attachment = await freshAttachment(message);
    if (attachment?.downloadUrl) {
      clickLink(attachment.downloadUrl);
      return;
    }
    if (!attachment?.url) throw new Error('No file');
    const blob = await (await fetch(attachment.url)).blob();
    const url = URL.createObjectURL(blob);
    clickLink(
      url,
      `photo-${message.id}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`
    );
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    throw new ChatError('INTERNAL', "Couldn't download the file");
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
  drafts.forEach((draft) => draft.abort?.abort());
  drafts.clear();
  refreshing.clear();
  inFlight.clear();
  typingSent.clear();
  store().reset();
};
