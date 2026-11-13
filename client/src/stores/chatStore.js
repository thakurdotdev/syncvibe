import { create } from 'zustand';
import { attachmentLabel } from '@/lib/attachments';

/**
 * Everything the app knows about direct messages. Only this file changes that state; lib/chat
 * talks to the server and calls these actions. The app has the same store in
 * app/stores/chatStore.ts: change them together.
 *
 * A message waiting to be sent sits in its thread like any other, with `id: null` and a
 * `status` of 'sending' or 'failed'. Its `clientId` stays the same once the server has it, so
 * that is what lists use as a key.
 */

const EMPTY_THREAD = { messages: [], hasMore: false, status: 'idle', loadingOlder: false };

const activityTime = (conversation) =>
  Date.parse(conversation.lastMessageAt || conversation.createdAt) || 0;

const sortConversations = (list) => [...list].sort((a, b) => activityTime(b) - activityTime(a));

const isPending = (message) => message.id == null;

/** Server messages in id order, then the ones still being sent in the order they were written. */
const orderMessages = (messages) => [
  ...messages.filter((m) => !isPending(m)).sort((a, b) => a.id - b.id),
  ...messages.filter(isPending),
];

/**
 * Puts a message from the server into a list, replacing the copy this device made while sending
 * it. What the device knows locally (the photo it picked) is kept, so the picture doesn't reload.
 */
const mergeMessage = (messages, message) => {
  const index = messages.findIndex(
    (m) => m.clientId === message.clientId || (m.id != null && m.id === message.id)
  );
  if (index === -1) return orderMessages([...messages, message]);
  const next = [...messages];
  next[index] = { ...message, localUrl: messages[index].localUrl };
  return orderMessages(next);
};

const unreadIn = (messages, meId, lastReadId) =>
  messages.filter((m) => !isPending(m) && m.senderId !== meId && m.id > lastReadId).length;

const patchConversation = (state, conversationId, patch) => {
  const index = state.conversations.findIndex((c) => c.id === conversationId);
  if (index === -1) return null;
  const current = state.conversations[index];
  const next = [...state.conversations];
  next[index] = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  return next;
};

const patchThread = (state, conversationId, patch) => {
  const current = state.threads[conversationId];
  if (!current) return state.threads;
  return {
    ...state.threads,
    [conversationId]: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) },
  };
};

const initialState = {
  meId: null,
  conversations: [],
  conversationsLoaded: false,
  /** The conversation on screen, if any. */
  activeId: null,
  /** conversationId → { messages, hasMore, status, loadingOlder } */
  threads: {},
  /** userId → online */
  presence: {},
  /** conversationId → the other person is typing */
  typing: {},
  /** clientId → how much of a file being sent has been uploaded, 0 to 1 */
  uploads: {},
};

export const useChatStore = create((set, get) => ({
  ...initialState,

  reset: () => set(initialState),
  setMe: (meId) => set({ meId }),
  setActive: (activeId) => set({ activeId }),

  setConversations: (list) =>
    set((state) => {
      // A conversation that was only just opened has no messages, so the server leaves it out.
      const opened = state.conversations.filter(
        (c) => !c.lastMessage && !list.some((fresh) => fresh.id === c.id)
      );
      const presence = { ...state.presence };
      for (const c of list) presence[c.peer.userid] = c.peer.online;
      return {
        conversations: sortConversations([...list, ...opened]),
        conversationsLoaded: true,
        presence,
      };
    }),

  upsertConversation: (conversation) =>
    set((state) => ({
      conversations: sortConversations([
        conversation,
        ...state.conversations.filter((c) => c.id !== conversation.id),
      ]),
      presence: { ...state.presence, [conversation.peer.userid]: conversation.peer.online },
    })),

  setThreadStatus: (conversationId, patch) =>
    set((state) => ({
      threads: {
        ...state.threads,
        [conversationId]: { ...EMPTY_THREAD, ...state.threads[conversationId], ...patch },
      },
    })),

  /**
   * The latest page from the server. If it overlaps what is loaded, older messages stay and the
   * page replaces the rest, which also drops anything deleted meanwhile. If it doesn't (a long
   * time away), the page replaces everything rather than leave a hole in the middle.
   */
  setLatestPage: (conversationId, page) =>
    set((state) => {
      const thread = state.threads[conversationId] ?? EMPTY_THREAD;
      const loaded = thread.messages.filter((m) => !isPending(m));
      const stillSending = thread.messages.filter(
        (m) => isPending(m) && !page.messages.some((fresh) => fresh.clientId === m.clientId)
      );
      const firstId = page.messages[0]?.id ?? Infinity;
      const overlaps = loaded.length > 0 && page.hasMore && loaded.some((m) => m.id >= firstId);
      const older = overlaps ? loaded.filter((m) => m.id < firstId) : [];
      const local = new Map(thread.messages.map((m) => [m.clientId, m.localUrl]));

      return {
        threads: {
          ...state.threads,
          [conversationId]: {
            ...thread,
            status: 'ready',
            hasMore: overlaps ? thread.hasMore : page.hasMore,
            messages: [
              ...older,
              ...page.messages.map((m) => ({ ...m, localUrl: local.get(m.clientId) })),
              ...stillSending,
            ],
          },
        },
      };
    }),

  addOlderPage: (conversationId, page) =>
    set((state) => ({
      threads: patchThread(state, conversationId, (thread) => {
        const known = new Set(thread.messages.map((m) => m.id));
        return {
          loadingOlder: false,
          hasMore: page.hasMore,
          messages: [...page.messages.filter((m) => !known.has(m.id)), ...thread.messages],
        };
      }),
    })),

  addPending: (message) =>
    set((state) => ({
      threads: patchThread(state, message.conversationId, (thread) => ({
        messages: [...thread.messages, message],
      })),
      // The conversation moves to the top straight away, showing what was just written.
      conversations: sortConversations(
        patchConversation(state, message.conversationId, {
          lastMessage: message,
          lastMessageAt: message.createdAt,
        }) ?? state.conversations
      ),
    })),

  setPendingStatus: (conversationId, clientId, status, error = null) =>
    set((state) => ({
      threads: patchThread(state, conversationId, (thread) => ({
        messages: thread.messages.map((m) =>
          m.clientId === clientId && isPending(m) ? { ...m, status, error } : m
        ),
      })),
    })),

  /** What was measured about a file after its message went on screen. */
  patchPendingAttachment: (conversationId, clientId, patch) =>
    set((state) => ({
      threads: patchThread(state, conversationId, (thread) => ({
        messages: thread.messages.map((m) =>
          m.clientId === clientId && isPending(m) && m.attachment
            ? { ...m, attachment: { ...m.attachment, ...patch } }
            : m
        ),
      })),
    })),

  removePending: (conversationId, clientId) =>
    set((state) => ({
      threads: patchThread(state, conversationId, (thread) => ({
        messages: thread.messages.filter((m) => !(m.clientId === clientId && isPending(m))),
      })),
    })),

  /**
   * A message from the server: one this device sent, one from the user's other device, or one
   * from the other person. Returns false when its conversation isn't known yet, so the caller can
   * fetch the list.
   */
  receiveMessage: (message) => {
    const state = get();
    const conversation = state.conversations.find((c) => c.id === message.conversationId);
    const mine = message.senderId === state.meId;

    set({
      threads: patchThread(state, message.conversationId, (thread) => ({
        messages: mergeMessage(thread.messages, message),
      })),
      typing: mine ? state.typing : { ...state.typing, [message.conversationId]: false },
    });
    if (!conversation) return false;

    const lastId = conversation.lastMessage?.id ?? 0;
    const isNew = message.id > lastId;
    const showsPending = conversation.lastMessage?.clientId === message.clientId;

    set((current) => ({
      conversations: sortConversations(
        patchConversation(current, conversation.id, (c) => ({
          lastMessage: isNew || showsPending ? message : c.lastMessage,
          lastMessageAt: isNew ? message.createdAt : c.lastMessageAt,
          // Read and delivered positions come only from receipts: a reply sent from a
          // notification doesn't mean the messages before it were read.
          unreadCount: !mine && isNew ? c.unreadCount + 1 : c.unreadCount,
        })) ?? current.conversations
      ),
    }));
    return true;
  },

  /** An edit, or a change to a message's reactions. */
  updateMessage: (message) =>
    set((state) => ({
      threads: patchThread(state, message.conversationId, (thread) => ({
        messages: thread.messages.map((m) =>
          m.id === message.id ? { ...message, localUrl: m.localUrl } : m
        ),
      })),
      conversations:
        patchConversation(state, message.conversationId, (c) =>
          c.lastMessage?.id === message.id ? { lastMessage: message } : {}
        ) ?? state.conversations,
    })),

  removeMessage: ({ conversationId, messageId, lastMessage }) =>
    set((state) => {
      const thread = state.threads[conversationId];
      const removed = thread?.messages.find((m) => m.id === messageId);
      return {
        threads: patchThread(state, conversationId, (t) => ({
          messages: t.messages
            .filter((m) => m.id !== messageId)
            .map((m) =>
              m.replyTo?.id === messageId
                ? { ...m, replyTo: { ...m.replyTo, deleted: true, body: null } }
                : m
            ),
        })),
        conversations:
          patchConversation(state, conversationId, (c) => {
            const sender = removed?.senderId ?? c.lastMessage?.senderId;
            const wasUnread =
              (removed || c.lastMessage?.id === messageId) &&
              sender !== state.meId &&
              messageId > c.myLastReadMessageId;
            return {
              lastMessage: lastMessage ?? null,
              unreadCount: wasUnread ? Math.max(0, c.unreadCount - 1) : c.unreadCount,
            };
          }) ?? state.conversations,
      };
    }),

  /** Someone's read or delivered position moved: the other person's, or ours on another device. */
  applyReceipt: (receipt) =>
    set((state) => ({
      conversations:
        patchConversation(state, receipt.conversationId, (c) => {
          if (receipt.userId !== state.meId) {
            return {
              peerLastReadMessageId: Math.max(c.peerLastReadMessageId, receipt.lastReadMessageId),
              peerLastReadAt: receipt.lastReadAt ?? c.peerLastReadAt,
              peerLastDeliveredMessageId: Math.max(
                c.peerLastDeliveredMessageId,
                receipt.lastDeliveredMessageId
              ),
            };
          }

          const lastRead = Math.max(c.myLastReadMessageId, receipt.lastReadMessageId);
          const thread = state.threads[c.id];
          const caughtUp = !c.lastMessage?.id || lastRead >= c.lastMessage.id;
          return {
            myLastReadMessageId: lastRead,
            unreadCount: caughtUp
              ? 0
              : thread?.status === 'ready'
                ? Math.min(c.unreadCount, unreadIn(thread.messages, state.meId, lastRead))
                : c.unreadCount,
          };
        }) ?? state.conversations,
    })),

  setUploadProgress: (clientId, progress) =>
    set((state) => {
      const uploads = { ...state.uploads };
      if (progress == null) delete uploads[clientId];
      else uploads[clientId] = progress;
      return { uploads };
    }),

  /** New links for a file, wherever it shows in the conversation. */
  replaceAttachment: (conversationId, attachment) =>
    set((state) => {
      const swap = (m) =>
        m?.attachment?.id === attachment.id ? { ...m, attachment: { ...attachment } } : m;
      return {
        threads: patchThread(state, conversationId, (thread) => ({
          messages: thread.messages.map(swap),
        })),
        conversations:
          patchConversation(state, conversationId, (c) => ({ lastMessage: swap(c.lastMessage) })) ??
          state.conversations,
      };
    }),

  setTyping: (conversationId, typing) =>
    set((state) => ({ typing: { ...state.typing, [conversationId]: typing } })),

  setPresence: (userId, online) =>
    set((state) => ({ presence: { ...state.presence, [userId]: online } })),
}));

// ── What screens read ───────────────────────────────────────────────────────

export const selectThread = (conversationId) => (state) =>
  state.threads[conversationId] ?? EMPTY_THREAD;

export const selectConversation = (conversationId) => (state) =>
  state.conversations.find((c) => c.id === conversationId) ?? null;

export const selectUnreadTotal = (state) =>
  state.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

/** 'sending' | 'failed' | 'sent' | 'delivered' | 'read' for a message the user wrote. */
export const messageStatus = (message, conversation) => {
  if (message.id == null) return message.status;
  if (!conversation) return 'sent';
  if (message.id <= conversation.peerLastReadMessageId) return 'read';
  if (message.id <= conversation.peerLastDeliveredMessageId) return 'delivered';
  return 'sent';
};

/** One line for a conversation list or a notification. */
export const previewOf = (message, meId) => {
  if (!message) return '';
  if (message.type === 'call') {
    const outcome = message.call?.outcome;
    if (outcome === 'missed') return message.senderId === meId ? 'No answer' : 'Missed call';
    if (outcome === 'rejected') return 'Declined call';
    return 'Video call';
  }
  const text = message.body || attachmentLabel(message.attachment);
  return message.senderId === meId ? `You: ${text}` : text;
};
