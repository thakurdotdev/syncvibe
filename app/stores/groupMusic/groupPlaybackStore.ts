import TrackPlayer from 'react-native-track-player';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Song } from '@/types/song';
import { setupPlayer } from '@/utils/playerSetup';
import { PlaybackState } from './types';

interface GroupPlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  serverTimeOffset: number;
  lastSync: number;
  trackPlayerReady: boolean;
}

interface GroupPlaybackActions {
  getServerTime: () => number;
  formatTime: (seconds: number) => string;

  initTrackPlayer: () => Promise<boolean>;
  convertSongToTrack: (song: Song) => {
    id: string;
    url: string;
    title: string;
    artist: string;
    album: string;
    artwork: string;
    duration: number;
  };

  processTimeSyncResponse: (clientTime: number, serverTime: number) => void;
  handlePlaybackUpdate: (data: {
    isPlaying: boolean;
    currentTime: number;
    scheduledTime?: number;
    serverTime?: number;
    isSeeking?: boolean;
  }) => Promise<void>;
  handleMusicUpdate: (data: {
    song: Song;
    currentTime: number;
    scheduledPlayTime?: number;
    scheduledTime?: number;
    serverTime?: number;
    autoPlay?: boolean;
  }) => Promise<void>;
  syncPlaybackFromServer: (
    playbackState: PlaybackState,
    queue: any[],
    currentQueueIndex: number
  ) => Promise<void>;

  handlePlayPause: (
    socket: any,
    groupId: string | undefined,
    forceState?: boolean
  ) => Promise<void>;
  handleSeek: (socket: any, groupId: string | undefined, value: number) => Promise<void>;

  startProgressPolling: () => void;
  stopProgressPolling: () => void;
  reset: () => void;
}

type GroupPlaybackStore = GroupPlaybackState & GroupPlaybackActions;

let progressInterval: NodeJS.Timeout | null = null;

const initialState: GroupPlaybackState = {
  currentSong: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  serverTimeOffset: 0,
  lastSync: 0,
  trackPlayerReady: false,
};

export const useGroupPlaybackStore = create<GroupPlaybackStore>()((set, get) => ({
  ...initialState,

  getServerTime: () => Date.now() + get().serverTimeOffset,

  formatTime: (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  initTrackPlayer: async () => {
    try {
      const isSetup = await setupPlayer();
      set({ trackPlayerReady: isSetup });
      return isSetup;
    } catch (error) {
      console.error('Error initializing TrackPlayer for group music:', error);
      return false;
    }
  },

  convertSongToTrack: (song: Song) => ({
    id: song.id,
    url: song.download_url?.find((u) => u.quality === '320kbps')?.link || '',
    title: song.name || 'Unknown Title',
    artist: song?.artist_map?.artists?.[0]?.name || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    artwork: song.image?.[2]?.link || song.image?.[1]?.link || '',
    duration: song.duration || 0,
  }),

  processTimeSyncResponse: (clientTime: number, serverTime: number) => {
    const endTime = Date.now();
    const roundTripTime = endTime - clientTime;
    const adjustedServerTime = serverTime + roundTripTime / 2;
    set({
      serverTimeOffset: adjustedServerTime - endTime,
      lastSync: endTime,
    });
  },

  handlePlaybackUpdate: async (data) => {
    const { trackPlayerReady } = get();
    if (!trackPlayerReady) return;

    const serverNow = get().getServerTime();
    const timeUntilPlay = Math.max(0, (data.scheduledTime || serverNow) - serverNow);

    await TrackPlayer.seekTo(data.currentTime);

    if (data.isPlaying) {
      setTimeout(async () => {
        await TrackPlayer.play();
        set({ isPlaying: true });
      }, timeUntilPlay);
    } else {
      await TrackPlayer.pause();
      set({ isPlaying: false });
    }

    set({ lastSync: serverNow });
  },

  handleMusicUpdate: async (data) => {
    const { trackPlayerReady, convertSongToTrack, getServerTime } = get();

    set({ currentSong: data.song, isLoading: true });

    if (!trackPlayerReady) {
      set({ isLoading: false });
      return;
    }

    try {
      await TrackPlayer.reset();
      const track = convertSongToTrack(data.song);
      await TrackPlayer.add([track]);

      const scheduledTime = data.scheduledPlayTime || data.scheduledTime;
      const timeUntilPlay = scheduledTime ? scheduledTime - getServerTime() : 0;

      setTimeout(
        async () => {
          await TrackPlayer.seekTo(data.currentTime || 0);
          await TrackPlayer.play();
          set({
            isPlaying: true,
            isLoading: false,
            currentTime: 0,
            duration: data.song.duration || 0,
          });
        },
        Math.max(0, timeUntilPlay)
      );
    } catch (error) {
      console.error('Error loading song:', error);
      set({ isLoading: false });
    }
  },

  syncPlaybackFromServer: async (playbackState, _queue, _currentQueueIndex) => {
    const { trackPlayerReady, convertSongToTrack, getServerTime } = get();

    if (!playbackState?.currentTrack) return;

    set({ currentSong: playbackState.currentTrack });

    if (!trackPlayerReady) return;

    try {
      await TrackPlayer.reset();
      const track = convertSongToTrack(playbackState.currentTrack);
      await TrackPlayer.add([track]);

      const serverNow = getServerTime();
      const timePassed = (serverNow - playbackState.lastUpdate) / 1000;
      const syncedTime = playbackState.isPlaying
        ? playbackState.currentTime + timePassed
        : playbackState.currentTime;

      await TrackPlayer.seekTo(syncedTime);

      if (playbackState.isPlaying) {
        await TrackPlayer.play();
        set({ isPlaying: true });
      }

      set({
        currentTime: syncedTime,
        duration: playbackState.currentTrack.duration || 0,
      });
    } catch (error) {
      console.error('Error syncing playback:', error);
    }
  },

  handlePlayPause: async (socket, groupId, forceState) => {
    const { trackPlayerReady, currentSong, isPlaying, getServerTime } = get();
    if (!trackPlayerReady || !currentSong || !groupId) return;

    const newIsPlaying = typeof forceState === 'boolean' ? forceState : !isPlaying;
    const currentAudioTime = await TrackPlayer.getProgress().then((p) => p.position);

    try {
      const scheduledTime = getServerTime() + 300;

      socket?.emit('music-playback', {
        groupId,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      });

      const delay = Math.max(0, scheduledTime - getServerTime());
      setTimeout(async () => {
        if (newIsPlaying) {
          await TrackPlayer.play();
        } else {
          await TrackPlayer.pause();
        }
        set({ isPlaying: newIsPlaying });
      }, delay);
    } catch (error) {
      console.error('Playback control error:', error);
    }
  },

  handleSeek: async (socket, groupId, value) => {
    const { trackPlayerReady, isPlaying, getServerTime } = get();
    if (!trackPlayerReady || !groupId) return;

    socket?.emit('music-seek', {
      groupId,
      currentTime: value,
      scheduledTime: getServerTime() + 300,
      isPlaying,
    });

    await TrackPlayer.seekTo(value);
    set({ currentTime: value });
  },

  startProgressPolling: () => {
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(async () => {
      const { trackPlayerReady, isPlaying } = get();
      if (!trackPlayerReady) return;

      try {
        const { position, duration } = await TrackPlayer.getProgress();
        set({ currentTime: position, duration: duration || get().duration });
      } catch {
        // TrackPlayer not ready
      }
    }, 500);
  },

  stopProgressPolling: () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  },

  reset: () => {
    const { stopProgressPolling, trackPlayerReady } = get();
    stopProgressPolling();

    if (trackPlayerReady) {
      TrackPlayer.reset().catch(() => {});
    }

    set({ ...initialState, trackPlayerReady: get().trackPlayerReady });
  },
}));

export const useGroupPlayback = () =>
  useGroupPlaybackStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      currentTime: s.currentTime,
      duration: s.duration,
      formatTime: s.formatTime,
      handlePlayPause: s.handlePlayPause,
      handleSeek: s.handleSeek,
    }))
  );

export const useGroupProgress = () =>
  useGroupPlaybackStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      duration: s.duration,
      formatTime: s.formatTime,
    }))
  );
