import { useShallow } from 'zustand/react/shallow';
import { ownsAudio } from '@/lib/player';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { getAudioElement, usePlayerStore } from '@/stores/playerStore';

/*
 * Starting a room from your own music: the song you're on, where it is, and what's queued after
 * it. The server takes as many as the room holds (server/src/socket/group-music/engine.ts,
 * `seedRoom`). The app has the same in app/lib/roomSeed.ts: change them together.
 */

/** The most any room holds, on any plan. */
const MAX_SONGS = 50;

const upNextOf = (playlist, currentSong) => {
  const index = playlist.findIndex((song) => song.id === currentSong?.id);
  return index === -1 ? [] : playlist.slice(index + 1);
};

/** What a new room would start with, or null if nothing is on. */
export const takeRoomSeed = () => {
  const { currentSong, playlist, currentTime, isPlaying } = usePlayerStore.getState();
  if (!currentSong?.id) return null;
  // This tab's audio is the most exact clock when it's the one playing.
  const audio = ownsAudio() ? getAudioElement() : null;
  const seconds = audio?.src ? audio.currentTime : currentTime;
  return {
    songs: [currentSong, ...upNextOf(playlist, currentSong)].slice(0, MAX_SONGS),
    positionMs: Math.round((Number(seconds) || 0) * 1000),
    playing: Boolean(isPlaying),
  };
};

/** The song you're on and how many follow it, for showing what a room would start with. */
export const useRoomSeedPreview = () =>
  usePlayerStore(
    useShallow((s) => ({
      song: s.currentSong?.id ? s.currentSong : null,
      upNext: Math.min(upNextOf(s.playlist, s.currentSong).length, MAX_SONGS - 1),
      playing: s.isPlaying,
    }))
  );

/** "Asha's room" for Asha Rao: a name you can keep or change. */
const roomNameFor = (userName) => {
  const first = String(userName || '')
    .trim()
    .split(/\s+/)[0];
  return first ? `${first}'s room` : '';
};

/** Opens the create form on Rooms (Pages/GroupMusic), already named, with your music on. */
export const openStartRoom = (userName) =>
  useGroupSessionStore.setState({ isGroupModalOpen: true, groupModalName: roomNameFor(userName) });
