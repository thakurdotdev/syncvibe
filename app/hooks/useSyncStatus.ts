import { usePlayerSessionStore, useRemoteDevice } from '@/stores/playerSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/*
 * Catching up with your other devices, as the orb shows it: `syncing` until the shared player
 * arrives, then `synced` for a moment. Shown when the app opens (and after a reconnect that takes
 * a while), only if there's music to sync.
 */

/** Quick syncs on a reconnect aren't worth showing; the first one since the app opened is. */
const SHOW_AFTER_MS = 300;
export const SYNCED_FOR_MS = 1600;

let shownOnce = false;

export type SyncStatus = 'syncing' | 'synced' | null;

export const useSyncStatus = () => {
  const sync = usePlayerSessionStore((s) => s.sync);
  const hasMusic = usePlayerSessionStore((s) => Boolean(s.playback?.song));
  const hasLocalSong = usePlayerStore((s) => Boolean(s.currentSong));
  const inRoom = usePlayerStore((s) => s.activePlayerMode === 'group');
  const remote = useRemoteDevice();
  // Which sync attempt (by start time) came up, and which one's "done" has gone.
  const [shownAt, setShownAt] = useState(-1);
  const [expiredAt, setExpiredAt] = useState(-1);

  useEffect(() => {
    if (sync.state === 'syncing') {
      const timer = setTimeout(
        () => {
          shownOnce = true;
          setShownAt(sync.at);
        },
        shownOnce ? SHOW_AFTER_MS : 0
      );
      return () => clearTimeout(timer);
    }
    if (sync.state === 'synced') {
      const timer = setTimeout(() => setExpiredAt(sync.at), SYNCED_FOR_MS);
      return () => clearTimeout(timer);
    }
  }, [sync.state, sync.at]);

  // A sync quick enough that it never showed says nothing when it's done either.
  const raw: SyncStatus =
    shownAt !== sync.at
      ? null
      : sync.state === 'syncing'
        ? 'syncing'
        : sync.state === 'synced' && expiredAt !== sync.at
          ? 'synced'
          : null;
  const status: SyncStatus = inRoom || (!hasMusic && !hasLocalSong) ? null : raw;

  return { status, remote };
};

/** The orb shows sync without words, so a screen reader is told in words. */
export const useAnnounceSync = (status: SyncStatus, remoteName?: string) => {
  useEffect(() => {
    if (status === 'syncing') AccessibilityInfo.announceForAccessibility('Syncing your music');
    else if (status === 'synced')
      AccessibilityInfo.announceForAccessibility(
        remoteName ? `Playing on ${remoteName}` : 'In sync with your devices'
      );
  }, [status, remoteName]);
};
