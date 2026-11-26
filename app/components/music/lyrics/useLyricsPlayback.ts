import { useGroupMusic } from '@/context/GroupMusicContext';
import { remoteProgress, seekPlayer } from '@/lib/player';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useCurrentSong, useNextSong } from '@/stores/playerStore';
import TrackPlayer from '@rntp/player';
import { useMemo } from 'react';
import { useRoomControl } from '../room/useRoomControl';

/**
 * Seconds into the song as you hear it: the phone's own player, which in a room is kept with the
 * room, or the playing device's position while another of your devices plays.
 */
export const heardPosition = () => (remoteProgress() ?? TrackPlayer.getProgress()).position;

/**
 * Which song the lyrics are for and what tapping a line does: in a room the room's song, and only
 * someone allowed to control playback moves it; otherwise your own song.
 */
export interface LyricsPlayback {
  songId: string | undefined;
  nextSongId: string | undefined;
  onSeek: ((seconds: number) => void) | undefined;
}

export const useLyricsPlayback = (): LyricsPlayback => {
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const roomSongId = useGroupPlaybackStore((s) => s.currentSong?.id);
  const roomNextId = useGroupSessionStore((s) => s.queue[s.currentQueueIndex + 1]?.song?.id);
  const ownSongId = useCurrentSong()?.id;
  const ownNextId = useNextSong()?.id;
  const { canControl } = useRoomControl();
  const { handleSeek } = useGroupMusic();

  return useMemo(
    (): LyricsPlayback =>
      inRoom
        ? {
            songId: roomSongId,
            nextSongId: roomNextId,
            onSeek: canControl
              ? (seconds: number): void => {
                  void handleSeek(seconds);
                }
              : undefined,
          }
        : { songId: ownSongId, nextSongId: ownNextId, onSeek: seekPlayer },
    [canControl, handleSeek, inRoom, ownNextId, ownSongId, roomNextId, roomSongId]
  );
};
