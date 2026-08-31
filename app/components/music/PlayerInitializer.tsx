import { useUser } from '@/context/UserContext';
import {
  destroyTrackPlayer,
  dispatchTrackPlayerEvent,
  initializeTrackPlayer,
  setBridgeUserId,
} from '@/stores/trackPlayerBridge';
import { usePlayerStore, setOnAfterSongTransition } from '@/stores/playerStore';
import { addToHistory } from '@/api/music';
import useApi from '@/utils/hooks/useApi';
import { useEffect } from 'react';
import TrackPlayer, { Event } from '@rntp/player';
import { useQueryClient } from '@tanstack/react-query';
import { runAfterIdle } from '@/utils/runAfterIdle';

export default function PlayerInitializer() {
  const { user } = useUser();
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Native player setup is small but interaction-critical. Deferring it can
    // make the first song tap disappear before the bridge is ready.
    void initializeTrackPlayer();

    return () => {
      destroyTrackPlayer();
    };
  }, []);

  useEffect(() => {
    setBridgeUserId(user?.userid);
  }, [user?.userid]);

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

    const task = runAfterIdle(() => {
      void fetchPlaylists();
    });

    return () => task.cancel();
  }, [user?.userid]);

  useEffect(() => {
    if (!user?.userid) {
      setOnAfterSongTransition(null);
      return;
    }

    setOnAfterSongTransition((song) => {
      addToHistory(api, song, 10)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['recentMusic'] });
          queryClient.invalidateQueries({ queryKey: ['musicHistory'] });
        })
        .catch(console.error);
    });
  }, [user?.userid, api, queryClient]);

  useEffect(() => {
    const subscriptions = [
      TrackPlayer.addEventListener(Event.PlaybackStateChanged, (event) => {
        dispatchTrackPlayerEvent({ type: Event.PlaybackStateChanged, ...event });
      }),
      TrackPlayer.addEventListener(Event.IsPlayingChanged, (event) => {
        // GroupMusicContext owns this event while group playback is active.
        if (usePlayerStore.getState().activePlayerMode === 'normal') {
          dispatchTrackPlayerEvent({ type: Event.IsPlayingChanged, ...event });
        }
      }),
      TrackPlayer.addEventListener(Event.MediaItemTransition, (event) => {
        dispatchTrackPlayerEvent({ type: Event.MediaItemTransition, ...event });
      }),
      TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
        dispatchTrackPlayerEvent({ type: Event.PlaybackError, ...event });
      }),
      TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
        dispatchTrackPlayerEvent({ type: Event.PlaybackProgressUpdated, ...event });
      }),
      TrackPlayer.addEventListener(Event.RemoteStop, () => {
        dispatchTrackPlayerEvent({ type: Event.RemoteStop });
      }),
    ];

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, []);

  return null;
}
