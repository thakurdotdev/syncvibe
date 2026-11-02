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

      playerSheetOpen: false,
      setPlayerSheetOpen: (playerSheetOpen) => set({ playerSheetOpen }),
    }),
    {
      name: 'syncvibe-ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
