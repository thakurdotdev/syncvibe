import { create } from 'zustand';

export const MOBILE_TABS = {
  chat: 'chat',
  queue: 'queue',
  people: 'people',
};

export const SIDEBAR_TABS = {
  chat: 'chat',
  people: 'people',
};

export const QUEUE_TABS = {
  upNext: 'up-next',
  playlists: 'playlists',
  forYou: 'for-you',
};

/**
 * Transient UI state for the room, so sibling panels can coordinate
 * (e.g. the empty player asking the queue panel to focus its search box).
 */
export const useRoomUi = create((set) => ({
  mobileTab: MOBILE_TABS.chat,
  sidebarTab: SIDEBAR_TABS.chat,
  queueTab: QUEUE_TABS.upNext,
  searchFocusRequest: 0,
  chatFocusRequest: 0,

  setMobileTab: (mobileTab) => set({ mobileTab }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setQueueTab: (queueTab) => set({ queueTab }),

  showPeople: () => set({ mobileTab: MOBILE_TABS.people, sidebarTab: SIDEBAR_TABS.people }),

  requestSearchFocus: () =>
    set((s) => ({
      mobileTab: MOBILE_TABS.queue,
      queueTab: QUEUE_TABS.upNext,
      searchFocusRequest: s.searchFocusRequest + 1,
    })),

  requestChatFocus: () =>
    set((s) => ({
      mobileTab: MOBILE_TABS.chat,
      sidebarTab: SIDEBAR_TABS.chat,
      chatFocusRequest: s.chatFocusRequest + 1,
    })),

  reset: () =>
    set({
      mobileTab: MOBILE_TABS.chat,
      sidebarTab: SIDEBAR_TABS.chat,
      queueTab: QUEUE_TABS.upNext,
    }),
}));
