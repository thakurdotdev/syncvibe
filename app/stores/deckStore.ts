import { createDeferredStorage } from '@/utils/deferredStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type DeckState = {
  /** The song (or room) card above the tabs (Settings → Player card). Off: the orb is the player. */
  showCard: boolean;
  setShowCard: (showCard: boolean) => void;
  /** Blur behind the floating bar (Settings → Glass bar). Off draws it solid, which costs less. */
  glass: boolean;
  setGlass: (glass: boolean) => void;
};

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      showCard: false,
      setShowCard: (showCard) => set({ showCard }),
      glass: true,
      setGlass: (glass) => set({ glass }),
    }),
    {
      name: 'deck-card',
      storage: createDeferredStorage(),
      partialize: (s) => ({ showCard: s.showCard, glass: s.glass }) as DeckState,
    }
  )
);
