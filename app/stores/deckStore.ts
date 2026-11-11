import { createDeferredStorage } from '@/utils/deferredStorage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What the floating card above the tab bar is showing: your song, or the room you're in. */
export type DeckCardKind = 'song' | 'room';

type DeckState = {
  /** Whether the card is out, kept per kind so hiding your song doesn't hide a room you join. */
  open: Record<DeckCardKind, boolean>;
  toggle: (kind: DeckCardKind) => void;
  /** Blur behind the floating bar (Settings → Glass bar). Off draws it solid, which costs less. */
  glass: boolean;
  setGlass: (glass: boolean) => void;
};

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      open: { song: true, room: true },
      toggle: (kind) => set((s) => ({ open: { ...s.open, [kind]: !s.open[kind] } })),
      glass: true,
      setGlass: (glass) => set({ glass }),
    }),
    {
      name: 'deck-card',
      storage: createDeferredStorage(),
      partialize: (s) => ({ open: s.open, glass: s.glass }) as DeckState,
    }
  )
);
