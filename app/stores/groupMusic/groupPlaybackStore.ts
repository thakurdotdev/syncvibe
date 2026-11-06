import TrackPlayer from '@rntp/player';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { setupPlayer } from '@/utils/playerSetup';
import { PlaybackState } from './types';
import { usePlayerStore } from '../playerStore';
import { isTrackPlayerReady, setResumePoint } from '../trackPlayerState';
import { playbackHistory } from '@/utils/playbackHistory';

interface GroupPlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  syncCountdown: number;
  currentTime: number;
  duration: number;
  serverTimeOffset: number;
  lastSync: number;
  trackPlayerReady: boolean;
  connectionQuality: 'good' | 'fair' | 'poor';
}

interface GroupPlaybackActions {
  getServerTime: () => number;
  formatTime: (seconds: number) => string;

  initTrackPlayer: () => Promise<boolean>;
  convertSongToTrack: (song: Song) => {
    mediaId: string;
    url: string;
    title: string;
    artist: string;
    albumTitle: string;
    artworkUrl?: string;
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

  /** Compares this phone against the room's timeline and quietly corrects any drift. */
  handleSyncState: (data: any) => Promise<void>;

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

let progressInterval: any = null;
let pendingStart: ReturnType<typeof setTimeout> | null = null;

/*
 * Staying with the room. The server keeps one timeline (a position at a moment in time), and each
 * device follows it rather than following each other, so a slow phone can't pull anyone else off.
 *  - Every few seconds the phone works out where the timeline is now and compares its own position.
 *  - A small gap closes by playing up to 5% fast or slow, which doesn't interrupt the sound.
 *  - A big gap takes a seek, aiming ahead if the audio there still has to be downloaded.
 *  - How long this phone takes to start sound is measured: it decides how far ahead to aim, and
 *    how high a quality to stream, so a slow connection also has less to download.
 */

/** How often the phone checks itself against the room. */
export const ROOM_SYNC_INTERVAL_MS = 8000;
/** After a play, pause, seek or song change, give the player this long before measuring it. */
export const ROOM_ACTION_SETTLE_MS = 1500;
/** Further off than this is worth a seek, even though a seek can briefly buffer. */
const SYNC_SEEK_S = 1;
/** Too small to hear between two phones side by side. */
const SYNC_TOLERANCE_S = 0.04;
/** Fastest or slowest correction speed: 5% is hard to notice with the pitch kept. */
const SYNC_MAX_NUDGE = 0.05;
/** On a resume, closer than this isn't worth a seek. */
const ALIGN_TOLERANCE_S = 0.05;
const CLOCK_SAMPLES = 8;
/**
 * On a slow connection a seek makes the player stop and download, leaving it behind again. Each
 * seek that doesn't settle things waits longer before the next, so it can't seek in a loop.
 */
const SEEK_GAP_MIN_MS = ROOM_SYNC_INTERVAL_MS;
const SEEK_GAP_MAX_MS = 60000;
/** Never aim further ahead than this, whatever the last load took. */
const MAX_AIM_AHEAD_S = 3;
/** Sound taking longer than these to start steps the streaming quality down. */
const SLOW_LOAD_S = 2.5;
const VERY_SLOW_LOAD_S = 5;
const QUALITIES = ['320kbps', '160kbps', '128kbps', '96kbps', '48kbps', '12kbps'] as const;

const clockSamples: { rtt: number; offset: number }[] = [];
let lastRoomActionAt = 0;
let roomSpeed = 1;
let seekNotBefore = 0;
let seekGapMs = SEEK_GAP_MIN_MS;
/** Seconds this phone usually takes from asking to play to sound coming out. */
let loadDelayS = 0.5;
let loadStartedAt: number | null = null;
/** What the room last told this phone. Anything different was done on the phone itself. */
let roomToldToPlay = false;

const markRoomAction = () => {
  lastRoomActionAt = Date.now();
};

const setRoomSpeed = (speed: number) => {
  if (speed === roomSpeed) return;
  roomSpeed = speed;
  TrackPlayer.setPlaybackSpeed(speed);
};

/** Starts a song and times how long sound takes to arrive (see noteRoomPlaybackStarted). */
const startRoomAudio = () => {
  roomToldToPlay = true;
  loadStartedAt = Date.now();
  TrackPlayer.play();
};

const aimAhead = () => Math.min(loadDelayS, MAX_AIM_AHEAD_S);

/** Call when the native player reports it has actually started playing. */
export const noteRoomPlaybackStarted = () => {
  if (loadStartedAt === null) return;
  const took = (Date.now() - loadStartedAt) / 1000;
  loadStartedAt = null;
  loadDelayS = loadDelayS * 0.5 + took * 0.5;
};

/*
 * Natural end-of-song detection. Swapping tracks (stop + clear + setMediaItems) while
 * something is playing — e.g. personal music when a room starts, or a new room song
 * arriving — makes the native player report "ended". Treating that as the song finishing
 * skipped the room's next song, whose swap fired "ended" again, cascading through the
 * whole queue. So: ignore "ended" during our own swaps, require the position to actually
 * be at the end, and accept at most one end per song.
 */
const SWAP_GUARD_MS = 1500;
const END_TOLERANCE_S = 3;
let swapGuardUntil = 0;
let endedSongId: string | null = null;

/** Call right before replacing the native queue for the room. */
const beginTrackSwap = (nextSongId?: string) => {
  swapGuardUntil = Date.now() + SWAP_GUARD_MS;
  if (nextSongId !== endedSongId) endedSongId = null;
};

/** True only when the room's current song genuinely played to its end (once per song). */
export const isNaturalGroupSongEnd = (): boolean => {
  if (Date.now() < swapGuardUntil) return false;
  const song = useGroupPlaybackStore.getState().currentSong;
  if (!song?.id || endedSongId === song.id) return false;

  try {
    const active = TrackPlayer.getActiveMediaItem() as any;
    const activeId = active?.mediaId || active?.id;
    if (activeId && activeId !== song.id) return false;

    const { position, duration } = TrackPlayer.getProgress();
    const total = duration || Number(song.duration) || 0;
    if (total > 0 && position < total - END_TOLERANCE_S) return false;
  } catch {
    return false;
  }

  endedSongId = song.id;
  return true;
};

// TrackPlayer is shared by the personal and group experiences. A group session
// must claim it before mutating the native queue so personal playback can never
// take control of synchronized playback. Your own song is kept (paused) rather
// than cleared: Home keeps showing it during the room, and once you leave the room
// pressing play continues from the exact spot the room interrupted.
const claimGroupPlayer = () => {
  const personalPlayer = usePlayerStore.getState();
  if (personalPlayer.activePlayerMode === 'group') return;

  const personalSong = personalPlayer.currentSong;
  if (personalSong?.id) {
    try {
      const active = TrackPlayer.getActiveMediaItem();
      if (active?.mediaId === personalSong.id) {
        const { position, duration } = TrackPlayer.getProgress();
        setResumePoint(personalSong.id, position);
        playbackHistory
          .updatePlaybackProgress(
            personalSong,
            position,
            duration || personalSong.duration || 0,
            false
          )
          .catch(console.error);
      }
    } catch {
      // Native player not ready: the last saved progress still stands.
    }
  }

  personalPlayer.setPlaying(false);
  personalPlayer.setLoading(false);
  personalPlayer.setActivePlayerMode('group');
};

const initialState: GroupPlaybackState = {
  currentSong: null,
  isPlaying: false,
  isLoading: false,
  isSyncing: false,
  syncCountdown: 0,
  currentTime: 0,
  duration: 0,
  serverTimeOffset: 0,
  lastSync: 0,
  trackPlayerReady: false,
  connectionQuality: 'good',
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
      const alreadyReady = isTrackPlayerReady();
      if (alreadyReady) {
        set({ trackPlayerReady: true });
        return true;
      }
      const isSetup = setupPlayer();
      set({ trackPlayerReady: isSetup });
      return isSetup;
    } catch (error) {
      console.error('Error initializing TrackPlayer for group music:', error);
      return false;
    }
  },

  convertSongToTrack: (rawSong: Song) => {
    // Room songs come straight from the server, and Android refuses to fetch http artwork.
    const song = ensureHttpsForSongUrls(rawSong);
    const firstChoice = loadDelayS > VERY_SLOW_LOAD_S ? 3 : loadDelayS > SLOW_LOAD_S ? 1 : 0;
    let audioUrl = '';
    for (const q of QUALITIES.slice(firstChoice)) {
      const link = song.download_url?.find((u) => u.quality === q)?.link;
      if (link) {
        audioUrl = link;
        break;
      }
    }
    if (!audioUrl) audioUrl = song.download_url?.[0]?.link || '';
    return {
      mediaId: song.id,
      url: audioUrl,
      title: song.name || 'Unknown Title',
      artist:
        song.artist_map?.primary_artists?.[0]?.name ||
        song.artist_map?.artists?.[0]?.name ||
        'Unknown Artist',
      albumTitle: song.album || 'Unknown Album',
      artworkUrl: song.image?.[2]?.link || song.image?.[1]?.link || song.image?.[0]?.link,
      duration: song.duration || 0,
    };
  },

  processTimeSyncResponse: (clientTime: number, serverTime: number) => {
    const endTime = Date.now();
    const rtt = endTime - clientTime;
    clockSamples.push({ rtt, offset: serverTime + rtt / 2 - endTime });
    if (clockSamples.length > CLOCK_SAMPLES) clockSamples.shift();
    // The fastest reply had the least time to be delayed one way more than the other, which is
    // what would throw this estimate off. Mobile networks vary a lot from one reply to the next.
    const best = clockSamples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    set({ serverTimeOffset: best.offset, lastSync: endTime });
  },

  handlePlaybackUpdate: async (data) => {
    const { trackPlayerReady, currentSong } = get();
    if (!trackPlayerReady) return;

    markRoomAction();
    setRoomSpeed(1);
    roomToldToPlay = data.isPlaying;

    if (data.isPlaying) {
      claimGroupPlayer();
    }

    // The message took time to get here, and the room kept playing meanwhile.
    const elapsed =
      data.isPlaying && data.serverTime
        ? Math.max(0, (get().getServerTime() - data.serverTime) / 1000)
        : 0;
    const target = typeof data.currentTime === 'number' ? data.currentTime + elapsed : null;

    const activeItem = TrackPlayer.getActiveMediaItem();
    const activeMediaId = activeItem?.mediaId || (activeItem as any)?.id;
    const correctTrackLoaded = currentSong && activeMediaId === currentSong.id;

    if (!correctTrackLoaded && currentSong) {
      beginTrackSwap(currentSong.id);
      TrackPlayer.stop();
      TrackPlayer.clear();
      TrackPlayer.setMediaItems([get().convertSongToTrack(currentSong)]);
      if (target !== null) TrackPlayer.seekTo(target + (data.isPlaying ? aimAhead() : 0));
    } else if (correctTrackLoaded && target !== null) {
      // A pause lands everyone on the same spot, as a seek does. A resume only seeks if it would
      // be heard to be off, since seeking can make the player stop to buffer.
      const off = Math.abs(TrackPlayer.getProgress().position - target);
      if (data.isSeeking || !data.isPlaying || off > ALIGN_TOLERANCE_S) TrackPlayer.seekTo(target);
    }

    if (data.isPlaying) TrackPlayer.play();
    else TrackPlayer.pause();

    set({
      isPlaying: data.isPlaying,
      lastSync: get().getServerTime(),
      ...(target !== null ? { currentTime: target } : {}),
    });
  },

  handleMusicUpdate: async (data) => {
    const { trackPlayerReady, convertSongToTrack, getServerTime } = get();

    set({ currentSong: data.song, isLoading: true });

    if (!trackPlayerReady) {
      set({ isLoading: false });
      return;
    }

    claimGroupPlayer();
    markRoomAction();
    setRoomSpeed(1);
    // A quick second skip must not let the first song's start run on the new one.
    if (pendingStart) clearTimeout(pendingStart);

    try {
      beginTrackSwap(data.song?.id);
      TrackPlayer.stop();
      TrackPlayer.clear();
      const track = convertSongToTrack(data.song);
      TrackPlayer.setMediaItems([track]);

      const scheduledTime = data.scheduledPlayTime || data.scheduledTime;
      const timeUntilPlay = scheduledTime ? scheduledTime - getServerTime() : 0;
      // Got here after the start time, or missed the start altogether: join where the room is
      // by the time this phone's sound will have started.
      const late = Math.max(0, -timeUntilPlay) / 1000;
      const startAt =
        (data.currentTime || 0) + late + (late > 0 || !scheduledTime ? aimAhead() : 0);

      // Downloading has already begun, so the wait until the start time doubles as a head start.
      pendingStart = setTimeout(
        () => {
          pendingStart = null;
          TrackPlayer.seekTo(startAt);
          startRoomAudio();
          set({
            isPlaying: true,
            isLoading: false,
            currentTime: startAt,
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

    claimGroupPlayer();
    markRoomAction();
    setRoomSpeed(1);
    seekGapMs = SEEK_GAP_MIN_MS;
    seekNotBefore = 0;
    roomToldToPlay = playbackState.isPlaying;

    try {
      beginTrackSwap(playbackState.currentTrack?.id);
      TrackPlayer.stop();
      TrackPlayer.clear();
      const track = convertSongToTrack(playbackState.currentTrack);
      TrackPlayer.setMediaItems([track]);

      // Just joined, so this phone's clock estimate may not be ready yet. The server's own time in
      // the message gives the elapsed time without one; the first check then fine-tunes it.
      const serverNow = (playbackState as any).serverTime ?? getServerTime();
      const timePassed = Math.max(0, (serverNow - playbackState.lastUpdate) / 1000);
      const syncedTime = playbackState.isPlaying
        ? playbackState.currentTime + timePassed + aimAhead()
        : playbackState.currentTime;

      TrackPlayer.seekTo(syncedTime);

      if (playbackState.isPlaying) {
        startRoomAudio();
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

  handleSyncState: async (data) => {
    const { trackPlayerReady, currentSong, getServerTime, handleMusicUpdate } = get();
    const room = data?.playbackState;
    if (!trackPlayerReady || !room?.currentTrack) return;
    // Just acted on an event: the player is still catching up, so this reading would mislead.
    if (Date.now() - lastRoomActionAt < ROOM_ACTION_SETTLE_MS) return;
    // A song is waiting for its start time, so not playing yet is exactly right.
    if (pendingStart) return;

    const sinceUpdate = room.isPlaying
      ? Math.max(0, (getServerTime() - room.lastUpdate) / 1000)
      : 0;
    const expected = room.currentTime + sinceUpdate;

    // A song change this phone missed, say during a connection drop.
    if (currentSong?.id !== room.currentTrack.id) {
      await handleMusicUpdate({ song: room.currentTrack, currentTime: expected });
      return;
    }

    if (!room.isPlaying) {
      setRoomSpeed(1);
      roomToldToPlay = false;
      if (TrackPlayer.isPlaying()) {
        TrackPlayer.pause();
        set({ isPlaying: false });
      }
      return;
    }

    if (!TrackPlayer.isPlaying()) {
      setRoomSpeed(1);
      // Missed the room resuming: catch up. Otherwise it's still buffering, or you paused from the
      // lock screen or took a call, and restarting it here would be wrong.
      if (!roomToldToPlay) {
        roomToldToPlay = true;
        markRoomAction();
        TrackPlayer.seekTo(expected + aimAhead());
        TrackPlayer.play();
      }
      return;
    }

    const total = Number(room.currentTrack.duration) || 0;
    if (total > 0 && expected >= total - 1) return;

    const { position, buffered } = TrackPlayer.getProgress();
    const drift = expected - position;
    const size = Math.abs(drift);

    if (size >= SYNC_SEEK_S && Date.now() >= seekNotBefore) {
      setRoomSpeed(1);
      markRoomAction();
      seekNotBefore = Date.now() + seekGapMs;
      seekGapMs = Math.min(seekGapMs * 2, SEEK_GAP_MAX_MS);
      // Already downloaded means an instant jump. Otherwise it will take a moment to start.
      TrackPlayer.seekTo(expected <= buffered ? expected : expected + aimAhead());
    } else if (size <= SYNC_TOLERANCE_S) {
      setRoomSpeed(1);
      seekGapMs = SEEK_GAP_MIN_MS;
    } else if (AppState.currentState !== 'active') {
      // Backgrounded timers can stall, so no speed is left running that nothing would turn off.
      setRoomSpeed(1);
    } else {
      // Close the gap by the next check, without the stop to buffer that a seek can cause. The
      // player keeps the pitch.
      const nudge = drift / (ROOM_SYNC_INTERVAL_MS / 1000);
      setRoomSpeed(1 + Math.max(-SYNC_MAX_NUDGE, Math.min(SYNC_MAX_NUDGE, nudge)));
    }
  },

  handlePlayPause: async (socket, groupId, forceState) => {
    const { trackPlayerReady, currentSong, isPlaying } = get();
    if (!trackPlayerReady || !currentSong || !groupId) return;

    claimGroupPlayer();

    const newIsPlaying = typeof forceState === 'boolean' ? forceState : !isPlaying;

    try {
      // Offline there's no room to wait for: the button still has to work on this phone.
      if (!socket?.connected) {
        roomToldToPlay = newIsPlaying;
        if (newIsPlaying) TrackPlayer.play();
        else TrackPlayer.pause();
        set({ isPlaying: newIsPlaying });
        return;
      }

      const active = TrackPlayer.getActiveMediaItem();
      const isActiveSong = (active?.mediaId || (active as any)?.id) === currentSong.id;
      // Read live: the store's copy is polled, so it can be half a second behind the audio and
      // would pull the whole room back by that much.
      const position = isActiveSong ? TrackPlayer.getProgress().position : get().currentTime;

      // Everyone, this phone included, acts on the server's broadcast, so all start from one
      // moment (see handlePlaybackUpdate).
      socket.emit('music-playback', { groupId, isPlaying: newIsPlaying, currentTime: position });
      set({ isPlaying: newIsPlaying });
    } catch (error) {
      console.error('Playback control error:', error);
    }
  },

  handleSeek: async (socket, groupId, value) => {
    const { trackPlayerReady, isPlaying } = get();
    if (!trackPlayerReady || !groupId) return;

    markRoomAction();
    socket?.emit('music-seek', { groupId, currentTime: value, isPlaying });

    TrackPlayer.seekTo(value);
    set({ currentTime: value });
  },

  startProgressPolling: () => {
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(() => {
      const { trackPlayerReady } = get();
      if (!trackPlayerReady) return;

      try {
        const { position, duration } = TrackPlayer.getProgress();
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
    clockSamples.length = 0;
    if (pendingStart) clearTimeout(pendingStart);
    pendingStart = null;
    loadStartedAt = null;
    roomToldToPlay = false;

    if (trackPlayerReady) {
      try {
        // Your own music must not carry on at a room's correction speed.
        setRoomSpeed(1);
        TrackPlayer.stop();
        TrackPlayer.clear();
      } catch {}
    }

    const normalStore = usePlayerStore.getState();
    if (normalStore.activePlayerMode === 'group') {
      normalStore.setActivePlayerMode('normal');
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
