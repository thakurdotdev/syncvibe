import { createDeferredStorage } from '@/utils/deferredStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Long enough for any message (the box allows 2000 characters). */
const MAX_DRAFT = 2000;

type DraftState = {
  /**
   * What was written in each chat and not sent, by conversation id. Kept on the phone so it is
   * still there after leaving the chat or closing the app. Signing out clears it (UserContext's
   * logout, which also clears AsyncStorage).
   */
  drafts: Record<string, string>;
  setDraft: (conversationId: number, text: string) => void;
  reset: () => void;
};

export const useChatDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (conversationId, text) =>
        set((s) => {
          const drafts = { ...s.drafts };
          if (text.trim()) drafts[conversationId] = text.slice(0, MAX_DRAFT);
          else delete drafts[conversationId];
          return { drafts };
        }),
      reset: () => set({ drafts: {} }),
    }),
    {
      name: 'chat-drafts',
      storage: createDeferredStorage(),
      partialize: (s) => ({ drafts: s.drafts }) as DraftState,
    }
  )
);

export const draftOf = (conversationId: number | null | undefined): string =>
  conversationId == null ? '' : (useChatDraftStore.getState().drafts[conversationId] ?? '');
