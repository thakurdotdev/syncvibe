import { useUser } from '@/context/UserContext';
import {
  destroyTrackPlayer,
  dispatchTrackPlayerEvent,
  initializeTrackPlayer,
  setBridgeUserId,
} from '@/stores/trackPlayerBridge';
import { usePlayerStore } from '@/stores/playerStore';
import useApi from '@/utils/hooks/useApi';
import { useEffect } from 'react';
import TrackPlayer, { Event } from '@rntp/player';

export default function PlayerInitializer() {
  const { user } = useUser();
  const api = useApi();

  useEffect(() => {
    initializeTrackPlayer(user?.userid);

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

    fetchPlaylists();
  }, [user?.userid]);

  useEffect(() => {
    const subscriptions = [
      TrackPlayer.addEventListener(Event.PlaybackStateChanged, (event) => {
        dispatchTrackPlayerEvent({ type: Event.PlaybackStateChanged, ...event });
      }),
      TrackPlayer.addEventListener(Event.IsPlayingChanged, (event) => {
        dispatchTrackPlayerEvent({ type: Event.IsPlayingChanged, ...event });
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
