import TrackPlayer from '@rntp/player';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { remoteProgress } from '@/lib/player';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { closeFullPlayer, usePlayerStore } from '@/stores/playerStore';
import type { Song } from '@/types/song';

/*
 * Starting a room from your own music: the song you're on, where it is, and what's queued after
 * it. The server takes as many as the room holds (server/src/socket/group-music/engine.ts,
 * `seedRoom`). The web has the same in client/src/lib/roomSeed.js: change them together.
 */

export interface RoomSeed {
  songs: Song[];
  positionMs: number;
  playing: boolean;
}

/** The most any room holds, on any plan. */
const MAX_SONGS = 50;

const upNextOf = (playlist: Song[], currentSong: Song | null) => {
  const index = playlist.findIndex((song) => song.id === currentSong?.id);
  return index === -1 ? [] : playlist.slice(index + 1);
};

const positionSeconds = (songId: string): number => {
  // Another of your devices playing it knows where it is; otherwise this phone's player does.
  const remote = remoteProgress();
  if (remote) return remote.position;
  try {
    if (TrackPlayer.getActiveMediaItem()?.mediaId !== songId) return 0;
    return TrackPlayer.getProgress().position || 0;
  } catch {
    return 0;
  }
};

/** What a new room would start with, or null if nothing is on. */
export const takeRoomSeed = (): RoomSeed | null => {
  const { currentSong, playlist, isPlaying } = usePlayerStore.getState();
  if (!currentSong?.id) return null;
  return {
    songs: [currentSong, ...upNextOf(playlist, currentSong)].slice(0, MAX_SONGS),
    positionMs: Math.round(positionSeconds(currentSong.id) * 1000),
    playing: Boolean(isPlaying),
  };
};

/** The song you're on and how many follow it, for showing what a room would start with. */
export const useRoomSeedPreview = () =>
  usePlayerStore(
    useShallow((s) => ({
      song: s.currentSong?.id && s.activePlayerMode === 'normal' ? s.currentSong : null,
      upNext: Math.min(upNextOf(s.playlist, s.currentSong).length, MAX_SONGS - 1),
      playing: s.isPlaying,
    }))
  );

/** "Asha's room" for Asha Rao: a name you can keep or change. */
export const roomNameFor = (userName?: string | null) => {
  const first = String(userName || '')
    .trim()
    .split(/\s+/)[0];
  return first ? `${first}'s room` : '';
};

/**
 * Opens the create form on Rooms, already named, with your music on. `name` names it after what
 * you started (a playlist or album) instead of after you.
 */
export const startRoomFromMusic = (userName?: string | null, name?: string | null) => {
  closeFullPlayer();
  useGroupSessionStore.setState({
    isGroupModalOpen: true,
    groupModalName: name?.trim() || roomNameFor(userName),
  });
  router.navigate('/(tabs)/group-music');
};
