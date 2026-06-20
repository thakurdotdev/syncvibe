import { useUser } from '@/context/UserContext';
import {
  destroyTrackPlayer,
  handleTrackPlayerEvents,
  initializeTrackPlayer,
  syncPlaySong,
  syncPlayPause,
} from '@/stores/trackPlayerBridge';
import { usePlayerStore } from '@/stores/playerStore';
import useApi from '@/utils/hooks/useApi';
import { useEffect, useRef } from 'react';
import TrackPlayer, {
  Event,
  RepeatMode,
  useTrackPlayerEvents,
} from 'react-native-track-player';

export default function PlayerInitializer() {
  const { user } = useUser();
  const api = useApi();
  const initialized = useRef(false);
  const prevSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initializeTrackPlayer(user?.userid);
    }

    return () => {
      destroyTrackPlayer();
    };
  }, []);

  useEffect(() => {
    if (!user?.userid) return;

    const fetchPlaylists = async () => {
      try {
        const { data } = await api.get('/api/playlist/get');
        if (data?.data) {
          usePlayerStore.getState().setUserPlaylist(data.data);
        }
      } catch (error) {
        console.error('Error fetching playlists:', error);
      }
    };

    fetchPlaylists();
  }, [user?.userid]);

  useEffect(() => {
    let prevSongId: string | null = usePlayerStore.getState().currentSong?.id ?? null;
    const unsubscribe = usePlayerStore.subscribe((state) => {
      const newSongId = state.currentSong?.id ?? null;
      if (newSongId && newSongId !== prevSongId) {
        prevSongId = newSongId;
        syncPlaySong(state.currentSong!, user?.userid);
      }
    });

    return unsubscribe;
  }, [user?.userid]);

  useEffect(() => {
    let prevIsPlaying = usePlayerStore.getState().isPlaying;
    const unsubscribe = usePlayerStore.subscribe((state) => {
      if (state.isPlaying !== prevIsPlaying) {
        prevIsPlaying = state.isPlaying;
        syncPlayPause();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let prevRepeatMode = usePlayerStore.getState().repeatMode;
    const unsubscribe = usePlayerStore.subscribe((state) => {
      if (state.repeatMode !== prevRepeatMode) {
        prevRepeatMode = state.repeatMode;
        const rntpRepeatMode =
          state.repeatMode === 'one'
            ? RepeatMode.Track
            : state.repeatMode === 'all'
              ? RepeatMode.Queue
              : RepeatMode.Off;
        TrackPlayer.setRepeatMode(rntpRepeatMode).catch(console.error);
      }
    });

    return unsubscribe;
  }, []);

  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackError,
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackQueueEnded,
      Event.RemoteDuck,
      Event.RemotePlay,
      Event.RemotePause,
      Event.RemoteStop,
      Event.RemoteNext,
      Event.RemotePrevious,
      Event.RemoteSeek,
      Event.RemoteJumpForward,
      Event.RemoteJumpBackward,
      Event.PlaybackProgressUpdated,
    ],
    async (event) => {
      await handleTrackPlayerEvents(event, user?.userid);
    }
  );

  return null;
}
