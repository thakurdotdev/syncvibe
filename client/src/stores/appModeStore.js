import { create } from "zustand"

const STORAGE_KEY = "syncvibe-app-mode"

const getSavedMode = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export const useAppModeStore = create((set) => ({
  mode: getSavedMode(),
  hasChosen: !!getSavedMode(),

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    set({ mode, hasChosen: true })
  },

  resetMode: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ mode: null, hasChosen: false })
  },

  isMusicMode: () => getSavedMode() === "music",
}))
