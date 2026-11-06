import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const WRITE_DELAY_MS = 500;

/**
 * Persist storage for a store that changes often. Zustand saves on every `set`, and stringifying
 * a whole queue on the JS thread each time stalls the UI during song changes. This writes after
 * things settle, skips changes to fields that aren't persisted, and flushes when the app leaves
 * the foreground so nothing is lost if Android kills it.
 */
export const createDeferredStorage = <S extends object>(): PersistStorage<S> => {
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastState: S | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    AsyncStorage.setItem(name, JSON.stringify(value)).catch(() => {});
  };

  AppState.addEventListener('change', (state) => {
    if (state !== 'active') flush();
  });

  return {
    getItem: async (name) => {
      const raw = await AsyncStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem: (name, value) => {
      if (lastState && sameFields(lastState, value.state)) return;
      lastState = value.state;
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, WRITE_DELAY_MS);
    },
    removeItem: (name) => {
      pending = null;
      lastState = null;
      return AsyncStorage.removeItem(name);
    },
  };
};

const sameFields = <S extends object>(a: S, b: S) =>
  (Object.keys(b) as (keyof S)[]).every((key) => a[key] === b[key]);
