import * as Crypto from 'expo-crypto';
import { File, UploadType } from 'expo-file-system';
import type { Socket } from 'socket.io-client';
import type { AttachmentKind } from '@/lib/attachments';
import {
  useChatStore,
  type Attachment,
  type ChatMessage,
  type Conversation,
  type MessagePage,
  type Receipt,
} from '@/stores/chatStore';
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

/** A file picked to send. `uri` may be a file:// or content:// address on this device. */
export interface PickedFile {
  key: string;
  uri: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  width?: number;
  height?: number;
  durationSec?: number;
}

interface Draft {
  body: string | null;
  file?: PickedFile;
  replyToId: number | null;
  abort?: AbortController;
  uploadId?: string | null;
  uploaded?: boolean;
}

interface UploadTarget {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
}

/**
 * What a message being sent still needs, by clientId: its text, its file and, once uploaded,
 * the upload's id. A message with a file uploads it straight to storage first, then is sent
 * naming it.
 */
const drafts = new Map<string, Draft>();
const inFlight = new Set<string>();

/** Progress is shown in steps, so a fast upload doesn't redraw the bubble constantly. */
const PROGRESS_STEP = 0.02;

const httpError = (error: unknown, fallback: string): ChatError => {
  const response = (error as { response?: { data?: { code?: string; message?: string } } })
    ?.response;
  if (response?.data?.code) {
    return new ChatError(response.data.code, response.data.message || fallback);
  }
  return new ChatError(response ? 'INTERNAL' : 'TIMEOUT', fallback);
};

const uploadFile = async (conversationId: number, clientId: string, draft: Draft) => {
  const file = draft.file!;
  let created: { attachment: { id: string }; upload: UploadTarget };
  try {
    ({ data: created } = await api.post(`/api/chat/conversations/${conversationId}/attachments`, {
      name: file.name,
      size: file.size,
      width: file.width,
      height: file.height,
      durationSec: file.durationSec,
    }));
  } catch (error) {
    throw httpError(error, "Couldn't send the file");
  }
  draft.uploadId = created.attachment.id;

  let shown = 0;
  store().setUploadProgress(clientId, 0);
  const abort = (draft.abort = new AbortController());
  let result;
  try {
    // The type must be exactly the one in the signed link; no other is added for raw uploads.
    result = await new File(file.uri)
      .createUploadTask(created.upload.url, {
        httpMethod: created.upload.method,
        uploadType: UploadType.BINARY_CONTENT,
        headers: created.upload.headers,
        signal: abort.signal,
        onProgress: ({ bytesSent, totalBytes }) => {
          const progress = totalBytes ? bytesSent / totalBytes : 0;
          if (progress - shown < PROGRESS_STEP && progress < 1) return;
          shown = progress;
          store().setUploadProgress(clientId, progress);
        },
      })
      .uploadAsync();
  } catch {
    throw new ChatError(abort.signal.aborted ? 'CANCELLED' : 'TIMEOUT', "Couldn't upload the file");
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ChatError('TIMEOUT', "Couldn't upload the file");
  }
  draft.uploaded = true;
};

const deliver = async (conversationId: number, clientId: string): Promise<void> => {
  const draft = drafts.get(clientId);
  if (!draft || inFlight.has(clientId)) return;
  inFlight.add(clientId);
  store().setPendingStatus(conversationId, clientId, 'sending');

  const send = async () => {
    if (draft.file && !draft.uploaded) await uploadFile(conversationId, clientId, draft);
    return command<{ message: ChatMessage }>('chat:send', {
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
      if (!(error instanceof ChatError) || error.code !== 'GONE' || !draft.file) throw error;
      draft.uploaded = false;
      draft.uploadId = null;
      reply = await send();
    }
    drafts.delete(clientId);
    store().setUploadProgress(clientId, null);
    store().receiveMessage(reply.message);
  } catch (error) {
    store().setUploadProgress(clientId, null);
    const code = error instanceof ChatError ? error.code : 'UPLOAD';
    if (code === 'CANCELLED') return;
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

const quoteOf = (replyTo?: ChatMessage | null) =>
  replyTo && replyTo.id != null
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

/** Sends text, files or both. Each file becomes its own message; the text goes with the first. */
export const sendMessage = (
  conversationId: number,
  input: { body?: string; files?: PickedFile[]; replyTo?: ChatMessage | null }
): void => {
  const text = input.body?.trim() || null;
  const files = input.files ?? [];
  const meId = store().meId;
  if ((!text && files.length === 0) || meId == null) return;
  setTyping(conversationId, false);

  const items: (PickedFile | null)[] = files.length ? files : [null];
  items.forEach((file, index) => {
    const clientId = Crypto.randomUUID();
    const body = index === 0 ? text : null;
    const replyTo = index === 0 ? input.replyTo : null;
    drafts.set(clientId, {
      body,
      file: file ?? undefined,
      replyToId: replyTo?.id ?? null,
    });

    store().addPending({
      id: null,
      clientId,
      conversationId,
      senderId: meId,
      type: !file ? 'text' : file.kind === 'image' ? 'image' : 'file',
      body,
      attachment: file
        ? {
            kind: file.kind,
            name: file.name,
            size: file.size,
            width: file.width,
            height: file.height,
            durationSec: file.durationSec,
            url: file.uri,
            downloadUrl: null,
          }
        : null,
      localUrl: file?.uri,
      call: null,
      replyTo: quoteOf(replyTo),
      reactions: [],
      editedAt: null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    });
    void deliver(conversationId, clientId);
  });
};

export const retryMessage = (message: ChatMessage) =>
  deliver(message.conversationId, message.clientId);

/** Removes a message that hasn't been sent, stopping its upload and dropping what was uploaded. */
export const discardMessage = (message: ChatMessage): void => {
  const draft = drafts.get(message.clientId);
  drafts.delete(message.clientId);
  draft?.abort?.abort();
  if (draft?.uploadId) api.delete(`/api/chat/attachments/${draft.uploadId}`).catch(() => {});
  store().setUploadProgress(message.clientId, null);
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

// ── Files ───────────────────────────────────────────────────────────────────

const refreshing = new Map<string, number>();
const REFRESH_AGAIN_AFTER_MS = 60_000;

/** Whether a file's links are about to run out, so they're renewed before they're used. */
const linksExpiring = (attachment: Attachment | null | undefined) =>
  Boolean(attachment?.expiresAt) && Date.parse(attachment!.expiresAt!) - Date.now() < 5 * 60_000;

/**
 * New links for a file whose links ran out (the app left open for hours). Asked at most once a
 * minute per file, so a file that really is gone doesn't make a request on every render.
 */
export const refreshAttachment = (message: ChatMessage): void => {
  const id = message.attachment?.id;
  if (!id || message.id == null) return;
  if (Date.now() - (refreshing.get(id) ?? 0) < REFRESH_AGAIN_AFTER_MS) return;
  refreshing.set(id, Date.now());
  api
    .get<{ attachment: Attachment }>(`/api/chat/attachments/${id}`)
    .then(({ data }) => store().replaceAttachment(message.conversationId, data.attachment))
    .catch(() => {});
};

/** The file's links, renewed first if they're about to run out. */
export const freshAttachment = async (message: ChatMessage): Promise<Attachment | null> => {
  const attachment = message.attachment;
  if (!attachment?.id || !linksExpiring(attachment)) return attachment;
  const { data } = await api.get<{ attachment: Attachment }>(
    `/api/chat/attachments/${attachment.id}`
  );
  store().replaceAttachment(message.conversationId, data.attachment);
  return data.attachment;
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
  drafts.forEach((draft) => draft.abort?.abort());
  drafts.clear();
  refreshing.clear();
  inFlight.clear();
  typingSent.clear();
  store().reset();
};
