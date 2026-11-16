import { createDeferredStorage } from '@/utils/deferredStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Enough to never save the same photo twice in practice, small enough to keep in storage. */
const SAVED_KEEP = 500;

type MediaState = {
  /**
   * Chats whose photos and videos also go to the phone's gallery (chat profile → Save to
   * gallery), each with when it was turned on: only what arrives after that is saved, not the
   * whole history. Other chats keep their media in SyncVibe until you save one yourself.
   */
  galleryChats: Record<string, number>;
  /** Attachments already saved, so scrolling past one again doesn't copy it again. */
  savedIds: string[];
  setChatGallery: (conversationId: number, on: boolean) => void;
  markSaved: (id: string) => void;
};

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      galleryChats: {},
      savedIds: [],
      setChatGallery: (conversationId, on) =>
        set((s) => {
          const galleryChats = { ...s.galleryChats };
          if (on) galleryChats[conversationId] = Date.now();
          else delete galleryChats[conversationId];
          return { galleryChats };
        }),
      markSaved: (id) => set((s) => ({ savedIds: [...s.savedIds, id].slice(-SAVED_KEEP) })),
    }),
    {
      name: 'chat-media',
      storage: createDeferredStorage(),
      partialize: (s) => ({ galleryChats: s.galleryChats, savedIds: s.savedIds }) as MediaState,
    }
  )
);
