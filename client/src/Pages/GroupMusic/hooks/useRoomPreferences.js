import { create } from 'zustand';

// Keys are shared with GroupMusicContext, which reads SFX autoplay directly from storage.
const STORAGE_KEYS = {
  sfxAutoPlay: 'syncvibe_sfx_autoplay',
  mediaBlur: 'syncvibe_media_blur',
};

const readBoolean = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
};

const writeBoolean = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be unavailable (private mode / quota); preference stays in memory.
  }
};

const createToggle = (set, get, field) => () => {
  const next = !get()[field];
  writeBoolean(STORAGE_KEYS[field], next);
  set({ [field]: next });
};

/** Per-device room preferences shared between the top bar menu and the chat. */
export const useRoomPreferences = create((set, get) => ({
  sfxAutoPlay: readBoolean(STORAGE_KEYS.sfxAutoPlay, true),
  mediaBlur: readBoolean(STORAGE_KEYS.mediaBlur, false),
  toggleSfxAutoPlay: createToggle(set, get, 'sfxAutoPlay'),
  toggleMediaBlur: createToggle(set, get, 'mediaBlur'),
}));
