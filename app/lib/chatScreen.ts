import { router } from 'expo-router';
import { useChatStore } from '@/stores/chatStore';

/**
 * Which conversation screens exist, and which one is in front. The store's `activeId` stays set
 * while another screen is pushed on top of the conversation, so it can't tell whether the user is
 * looking at it: this can. Kept up to date by app/message.tsx.
 */
let onScreen: { conversationId: number } | null = null;
let mounted = 0;

/** Returns a function that takes it off, which does nothing once another screen has taken over. */
export const putConversationOnScreen = (conversationId: number): (() => void) => {
  const entry = { conversationId };
  onScreen = entry;
  return () => {
    if (onScreen === entry) onScreen = null;
  };
};

export const conversationOnScreen = (): number | null => onScreen?.conversationId ?? null;

/** Called by the conversation screen when it mounts; returns what to call when it unmounts. */
export const registerConversationScreen = (): (() => void) => {
  mounted += 1;
  return () => {
    mounted -= 1;
  };
};

/**
 * Opens a conversation. There is only ever one conversation screen: one already in front switches
 * to it, and one lower down (under a profile, say) is gone back to instead of pushing another.
 */
export const openConversation = (conversationId: number): void => {
  useChatStore.getState().setActive(conversationId);
  if (onScreen) return;
  if (mounted > 0) router.dismissTo('/message');
  else router.push('/message');
};
