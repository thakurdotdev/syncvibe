import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_DRAFT = 2000;

/**
 * What was written in each chat and not sent, by conversation id: still there after switching
 * chats or reloading the tab. Kept for the tab only (sessionStorage), since computers are shared
 * more than phones, and cleared on sign-out (useLogout).
 */
export const useChatDraftStore = create(
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    }
  )
);

export const draftOf = (conversationId) =>
  conversationId == null ? '' : (useChatDraftStore.getState().drafts[conversationId] ?? '');
