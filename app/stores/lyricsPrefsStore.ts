import { createDeferredStorage } from '@/utils/deferredStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LyricsPrefs = {
  /** The two lines under the cover (the mic button in the player). */
  showLyrics: boolean;
  setShowLyrics: (showLyrics: boolean) => void;
};

export const useLyricsPrefs = create<LyricsPrefs>()(
  persist(
    (set) => ({
      showLyrics: true,
      setShowLyrics: (showLyrics) => set({ showLyrics }),
    }),
    {
      name: 'lyrics-prefs',
      storage: createDeferredStorage(),
      partialize: (s) => ({ showLyrics: s.showLyrics }) as LyricsPrefs,
    }
  )
);
