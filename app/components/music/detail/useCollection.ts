import { playStationFrom } from '@/components/music/home/playStation';
import { playable } from '@/components/music/useSongPress';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { startRoomFromMusic } from '@/lib/roomSeed';
import { toastRoomAdd, useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import type { Song } from '@/types/song';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

const shuffled = <T>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const ROOM_PAUSED = 'Your music is paused while the room plays';

/**
 * Plays `list` from `index`, with the rest queued after it. Tapping the song that's already
 * playing pauses or resumes it; in a room, says your music is paused instead.
 */
export async function playList(list: Song[], index: number) {
  const player = usePlayerStore.getState();
  const song = list[index];
  if (!song) return;
  if (player.activePlayerMode === 'group') {
    toast(ROOM_PAUSED);
    return;
  }
  if (player.currentSong?.id === song.id) {
    player.handlePlayPause();
    return;
  }
  // Songs from some lists come without their audio links. Those play the way Home does, which
  // fetches the links as it goes; a list that has them all is queued whole.
  if (list.some((s) => !s?.download_url?.length)) {
    await playStationFrom(list, index);
    return;
  }
  try {
    player.setPlaylist(list);
    player.playSong(await playable(song));
  } catch {
    toast(`Couldn't play ${song.name}`, { type: 'error' });
  }
}

/**
 * Playing a list from its page: the whole list, shuffled, or from the song you tap, with the
 * rest queued after it. `active` is true while the song playing is one of this list's.
 */
export function useCollection(songs: Song[]) {
  const ids = useMemo(() => new Set(songs.map((song) => song?.id)), [songs]);
  const { active, playing } = usePlayerStore(
    useShallow((s) => {
      const active = !!s.currentSong && ids.has(s.currentSong.id);
      return { active, playing: active && s.isPlaying };
    })
  );

  const start = playList;

  const playAt = useCallback((index: number) => start(songs, index), [start, songs]);

  /** The big button: starts the list, or pauses and resumes it once it's playing. */
  const toggle = useCallback(() => {
    const player = usePlayerStore.getState();
    if (active && player.activePlayerMode === 'normal') player.handlePlayPause();
    else void start(songs, 0);
  }, [active, start, songs]);

  const shuffle = useCallback(() => start(shuffled(songs), 0), [start, songs]);

  /** Makes sure the list is playing, without pausing it if it already is. */
  const ensurePlaying = useCallback(() => {
    const player = usePlayerStore.getState();
    if (!active) void start(songs, 0);
    else if (!player.isPlaying) player.handlePlayPause();
  }, [active, start, songs]);

  return { active, playing, playAt, toggle, shuffle, ensurePlaying };
}

export type Collection = ReturnType<typeof useCollection>;

/**
 * The room button: adds the list to the room you're in, or starts a room with it playing.
 * Returns null when it has nothing to offer (signed out, or nothing to play).
 */
export function useRoomAction(songs: Song[], name: string | undefined, collection: Collection) {
  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const { addPlaylistToQueue } = useGroupMusic();
  const { user } = useUser();
  const { ensurePlaying } = collection;

  const inRoom = Boolean(currentGroup);
  const run = useCallback(() => {
    if (!songs.length) return;
    if (inRoom) {
      addPlaylistToQueue(songs);
      toastRoomAdd(user?.userid, `Added ${songs.length} songs to the room`);
      return;
    }
    ensurePlaying();
    startRoomFromMusic(user?.name, name);
  }, [songs, inRoom, addPlaylistToQueue, user?.userid, user?.name, ensurePlaying, name]);

  if (!songs.length || (!inRoom && !user?.userid)) return null;
  return { inRoom, run };
}
