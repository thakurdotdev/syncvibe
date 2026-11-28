import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useChatStore, type ChatMessage, type Conversation, type Thread } from '@/stores/chatStore';

/**
 * The conversation list and the latest messages of the recent conversations, kept on the phone
 * so Messages and a chat opened from a notification show at once, and can be read offline. The
 * server's copy replaces it as soon as it arrives; nothing here is ever sent.
 *
 * One slot, marked with whose it is: another account signing in on the phone never sees it.
 * Signing out clears AsyncStorage, which removes it.
 */

const KEY = 'chat:cache:v1';
const MAX_CONVERSATIONS = 30;
const MAX_THREADS = 15;
const MAX_MESSAGES = 40;
/** AsyncStorage keeps all of the app's values in one small database; this stays well inside it. */
const MAX_CHARS = 1_500_000;
const WRITE_DELAY_MS = 1500;

export interface CachedThread {
  messages: ChatMessage[];
  hasMore: boolean;
}

interface Cached {
  userId: number;
  conversations: Conversation[];
  threads: Record<number, CachedThread>;
}

const store = () => useChatStore.getState();

/** Only what the server has stored: a message still being sent can't be resent after a restart. */
const keepable = (thread: Thread): CachedThread | null => {
  if (thread.status !== 'ready') return null;
  const stored = thread.messages.filter((m) => m.id != null);
  if (stored.length === 0) return null;
  const messages = stored.slice(-MAX_MESSAGES).map(({ localUrl: _local, ...m }) => m);
  return { messages, hasMore: thread.hasMore || stored.length > MAX_MESSAGES };
};

const snapshot = (userId: number): string | null => {
  const { conversations, threads } = store();
  if (conversations.length === 0) return null;
  const kept = conversations.slice(0, MAX_CONVERSATIONS);

  const cachedThreads: [number, CachedThread][] = [];
  for (const conversation of kept) {
    if (cachedThreads.length >= MAX_THREADS) break;
    const thread = threads[conversation.id];
    const cached = thread ? keepable(thread) : null;
    if (cached) cachedThreads.push([conversation.id, cached]);
  }

  // The least recent conversations' messages go first when it's too big.
  while (true) {
    const value: Cached = {
      userId,
      conversations: kept,
      threads: Object.fromEntries(cachedThreads),
    };
    const json = JSON.stringify(value);
    if (json.length <= MAX_CHARS) return json;
    if (cachedThreads.length === 0) return null;
    cachedThreads.pop();
  }
};

/** Puts the saved list and messages in the store, unless the server's have arrived already. */
export const restoreChatCache = async (userId: number): Promise<void> => {
  let cached: Cached | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return;
  }
  if (!cached) return;
  if (cached.userId !== userId) {
    AsyncStorage.removeItem(KEY).catch(() => {});
    return;
  }
  // Signed out, or someone else signed in, while it was being read.
  if (store().meId !== userId) return;
  store().hydrate(cached.conversations ?? [], cached.threads ?? {});
};

/** Saves a short while after the list or a conversation changes. Returns what stops it. */
export const startChatCache = (userId: number): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const write = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (stopped || store().meId !== userId) return;
    const json = snapshot(userId);
    if (json) AsyncStorage.setItem(KEY, json).catch(() => {});
  };

  const unsubscribe = useChatStore.subscribe((state, previous) => {
    if (state.conversations === previous.conversations && state.threads === previous.threads) {
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, WRITE_DELAY_MS);
  });
  // Android may end the app once it's in the background: whatever is waiting is written now.
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active' && timer) write();
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
    appState.remove();
  };
};
