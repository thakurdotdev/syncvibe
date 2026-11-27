import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** App-shell UI state shared between the sidebar, top bar and player. */
export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      searchOpen: false,
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
      /** 'songs' | 'history' | 'playlists' — remembered between opens. */
      searchScope: 'songs',
      setSearchScope: (searchScope) => set({ searchScope }),

      playerSheetOpen: false,
      setPlayerSheetOpen: (playerSheetOpen) => set({ playerSheetOpen }),

      /** Two lines of the lyrics under the cover (the mic button in the player). */
      showLyrics: true,
      setShowLyrics: (showLyrics) => set({ showLyrics }),
    }),
    {
      name: 'syncvibe-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        searchScope: s.searchScope,
        showLyrics: s.showLyrics,
      }),
    }
  )
);
