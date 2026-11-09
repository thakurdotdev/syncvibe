import TrackPlayer from '@rntp/player';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { setupPlayer } from '@/utils/playerSetup';
import { usePlayerStore } from '../playerStore';
import { isTrackPlayerReady, setResumePoint } from '../trackPlayerState';
import { playbackHistory } from '@/utils/playbackHistory';
import { toast } from '@/context/ToastContext';
import { clockQuality, resetClock, serverNow } from './roomClock';
import { sendRoomCommand } from './roomProtocol';
import {
  DRIFT_CHECK_MS,
  planCorrection,
  roomPositionS,
  syncStatusOf,
  type RoomPlayback,
  type SyncStatus,
} from './roomSync';
import type { QueueItem } from './types';

type RoomSocket = Socket | null | undefined;
/** What prompted lining up with the room: a change it announced, or this phone (re)joining it. */
type AlignKind = 'track' | 'play' | 'pause' | 'seek' | 'stop' | 'join' | 'sync';

interface GroupPlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  trackPlayerReady: boolean;
  connectionQuality: 'good' | 'fair' | 'poor';
  /** How closely this phone is following the room. */
  syncStatus: SyncStatus;
  /**
   * Plays this much ahead of the room (negative: behind), to make up for speakers that add their
   * own delay, such as Bluetooth ones. Kept on this phone.
   */
  outputOffsetMs: number;
}

interface GroupPlaybackActions {
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

  /** Where to send what this phone's player reports, such as a song ending. */
  setTransport: (socket: RoomSocket, groupId: string | undefined) => void;
  getPlaybackRev: () => number;
  /**
   * The room's playback changed, or this phone is joining it. Each one replaces what was known,
   * so an older message arriving late is dropped rather than applied over a newer one.
   */
  applyPlayback: (
    part: RoomPlayback | null | undefined,
    kind: AlignKind,
    options?: { force?: boolean }
  ) => boolean;
  /** Compares this phone against the room's timeline and quietly corrects any drift. */
  checkDrift: () => void;
  /** The native player reached the end of the room's song. */
  reportSongEnded: () => void;
  noteClockUpdate: () => void;
  setOutputOffset: (ms: number) => void;

  handlePlayPause: (
    socket: RoomSocket,
    groupId: string | undefined,
    forceState?: boolean
  ) => Promise<void>;
  handleSeek: (socket: RoomSocket, groupId: string | undefined, value: number) => Promise<void>;

  startProgressPolling: () => void;
  stopProgressPolling: () => void;
  reset: () => void;
}

type GroupPlaybackStore = GroupPlaybackState & GroupPlaybackActions;

let progressInterval: any = null;
let pendingStart: ReturnType<typeof setTimeout> | null = null;

/*
 * Staying with the room. The server keeps one timeline (a position at a moment of its clock), and
 * each device follows it rather than following each other, so a slow phone can't pull anyone else
 * off. This phone knows the server's clock (see roomClock), so it can work out where the song
 * should be at any instant without asking.
 *  - A change from the room is applied the moment it arrives. Starts are scheduled slightly
 *    ahead, so every device begins at the same instant.
 *  - Once a second the phone compares its own position with the timeline. A small gap closes by
 *    playing up to 5% fast or slow, which doesn't interrupt the sound.
 *  - A big gap takes a seek, aiming ahead if the audio there still has to be downloaded.
 *  - How long this phone takes to start sound is measured: it decides how far ahead to aim, and
 *    how high a quality to stream, so a slow connection also has less to download.
 * The phone never tells other devices where the song is. It only asks the server for changes.
 */

/** After a play, pause, seek or song change, give the player this long before measuring it. */
export const ROOM_ACTION_SETTLE_MS = 1500;
/** On a pause or resume, closer than this isn't worth a seek. */
const ALIGN_TOLERANCE_S = 0.05;
/**
 * On a slow connection a seek makes the player stop and download, leaving it behind again. Each
 * seek that doesn't settle things waits longer before the next, so it can't seek in a loop.
 */
const SEEK_GAP_MIN_MS = 4000;
const SEEK_GAP_MAX_MS = 60000;
/** Never aim further ahead than this, whatever the last load took. */
const MAX_AIM_AHEAD_S = 3;
/** Sound taking longer than these to start steps the streaming quality down. */
const SLOW_LOAD_S = 2.5;
const VERY_SLOW_LOAD_S = 5;
const QUALITIES = ['320kbps', '160kbps', '128kbps', '96kbps', '48kbps', '12kbps'] as const;
const OFFSET_KEY = '@syncvibe_room_audio_offset';
export const MAX_OUTPUT_OFFSET_MS = 500;

/** The room's playback as last told. */
let room: RoomPlayback | null = null;
let transport: { socket: RoomSocket; groupId: string | undefined } = {
  socket: null,
  groupId: undefined,
};
/** The queue entry whose song is in the native player. */
let loadedItemId: string | null = null;
let driftTimer: ReturnType<typeof setInterval> | null = null;
let lastRoomActionAt = 0;
let roomSpeed = 1;
let seekNotBefore = 0;
let seekGapMs = SEEK_GAP_MIN_MS;
/** Seconds this phone usually takes from asking to play to sound coming out. */
let loadDelayS = 0.5;
let loadStartedAt: number | null = null;
/**
 * What the room last had this phone do. If the player is silent while this says play, it was
 * stopped on the phone itself (lock screen, a call), and the room shouldn't restart it.
 */
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
  currentTime: 0,
  duration: 0,
  trackPlayerReady: false,
  connectionQuality: 'good',
  syncStatus: 'synced',
  outputOffsetMs: 0,
};

const clearPendingStart = () => {
  if (pendingStart) clearTimeout(pendingStart);
  pendingStart = null;
};

const nativeSongId = (): string | undefined => {
  try {
    const active = TrackPlayer.getActiveMediaItem() as any;
    return active?.mediaId || active?.id;
  } catch {
    return undefined;
  }
};

export const useGroupPlaybackStore = create<GroupPlaybackStore>()((set, get) => ({
  ...initialState,

  formatTime: (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  initTrackPlayer: async () => {
    try {
      const alreadyReady = isTrackPlayerReady();
      const isSetup = alreadyReady || setupPlayer();
      set({ trackPlayerReady: isSetup });
      // A room joined before the player was ready has been waiting for this.
      if (isSetup && room?.item) align('join');
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

  setTransport: (socket, groupId) => {
    transport = { socket, groupId };
  },

  getPlaybackRev: () => room?.rev ?? 0,

  applyPlayback: (part, kind, options) => {
    if (!part || typeof part.rev !== 'number') return false;
    if (!options?.force && room && part.rev <= room.rev) return false;
    room = {
      rev: part.rev,
      item: part.item || null,
      playing: Boolean(part.playing),
      positionMs: part.positionMs || 0,
      anchorAt: part.anchorAt || 0,
    };

    if (!room.item) {
      clearPendingStart();
      stopDriftChecks();
      roomToldToPlay = false;
      loadedItemId = null;
      get().stopProgressPolling();
      if (get().trackPlayerReady && usePlayerStore.getState().activePlayerMode === 'group') {
        try {
          beginTrackSwap();
          setRoomSpeed(1);
          TrackPlayer.stop();
          TrackPlayer.clear();
        } catch {}
      }
      set({
        currentSong: null,
        isPlaying: false,
        isLoading: false,
        currentTime: 0,
        duration: 0,
        syncStatus: 'synced',
      });
      return true;
    }

    const song = room.item.song;
    if (get().currentSong?.id !== song.id) {
      set({ currentSong: song, duration: Number(song.duration) || 0 });
    }
    // Lined up as soon as the native player is ready (see initTrackPlayer).
    if (get().trackPlayerReady) align(kind);
    return true;
  },

  checkDrift: () => {
    const { trackPlayerReady } = get();
    if (!trackPlayerReady || !room?.item || !room.playing || pendingStart) return;
    if (usePlayerStore.getState().activePlayerMode !== 'group') return;
    // Just acted on a change: the player is still catching up, so this reading would mislead.
    if (Date.now() - lastRoomActionAt < ROOM_ACTION_SETTLE_MS) return;

    // Still buffering, or you paused from the lock screen or took a call: restarting it here
    // would be wrong. A resume from the room goes through applyPlayback, not this.
    if (!TrackPlayer.isPlaying()) {
      setRoomSpeed(1);
      return;
    }

    const expected = targetNow(get().outputOffsetMs);
    const total = Number(room.item.song.duration) || 0;
    if (total > 0 && expected >= total - 1) return;

    const { position, buffered } = TrackPlayer.getProgress();
    const drift = expected - position;
    const plan = planCorrection(drift, {
      canSeek: Date.now() >= seekNotBefore,
      // Backgrounded timers can stall, so no speed is left running that nothing would turn off.
      canNudge: AppState.currentState === 'active',
    });

    if (plan.type === 'seek') {
      markRoomAction();
      seekNotBefore = Date.now() + seekGapMs;
      seekGapMs = Math.min(seekGapMs * 2, SEEK_GAP_MAX_MS);
      // Already downloaded means an instant jump. Otherwise it will take a moment to start.
      TrackPlayer.seekTo(expected <= buffered ? expected : expected + aimAhead());
    } else if (plan.type === 'hold') {
      seekGapMs = SEEK_GAP_MIN_MS;
    }
    setRoomSpeed(plan.rate);

    const syncStatus = syncStatusOf(drift);
    if (get().syncStatus !== syncStatus) set({ syncStatus });
  },

  reportSongEnded: () => {
    const itemId = room?.item?.id;
    // The room moves on by itself; this just lets it do so the moment the sound stops.
    if (itemId) void sendRoomCommand(transport.socket, transport.groupId, 'ended', { itemId });
  },

  noteClockUpdate: () => {
    const connectionQuality = clockQuality();
    if (get().connectionQuality !== connectionQuality) set({ connectionQuality });
  },

  setOutputOffset: (ms) => {
    const outputOffsetMs = Math.max(
      -MAX_OUTPUT_OFFSET_MS,
      Math.min(MAX_OUTPUT_OFFSET_MS, Math.round(Number(ms) || 0))
    );
    set({ outputOffsetMs });
    AsyncStorage.setItem(OFFSET_KEY, String(outputOffsetMs)).catch(() => {});
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

      // The room never stopped, only this phone did (lock screen, a call): rejoin it where it is.
      if (newIsPlaying && room?.playing) {
        align('play');
        return;
      }

      // A pause is felt at once; the room's answer then settles the exact spot for everyone.
      if (!newIsPlaying) {
        clearPendingStart();
        markRoomAction();
        setRoomSpeed(1);
        TrackPlayer.pause();
        set({ isPlaying: false });
      }

      const result = await sendRoomCommand(socket, groupId, newIsPlaying ? 'play' : 'pause');
      if (!result.ok) {
        toast(result.error, { type: 'error' });
        align('sync');
      }
    } catch (error) {
      console.error('Playback control error:', error);
    }
  },

  handleSeek: async (socket, groupId, value) => {
    const { trackPlayerReady } = get();
    if (!trackPlayerReady || !groupId) return;

    // Not queued for later: by the time a disconnected socket sent it, it would be out of date.
    if (!socket?.connected) {
      TrackPlayer.seekTo(value);
      set({ currentTime: value });
      return;
    }

    markRoomAction();
    TrackPlayer.seekTo(value);
    set({ currentTime: value });

    const result = await sendRoomCommand(socket, groupId, 'seek', {
      positionMs: Math.round(value * 1000),
    });
    if (!result.ok) {
      toast(result.error, { type: 'error' });
      align('seek');
    }
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
    stopDriftChecks();
    clearPendingStart();
    resetClock();
    room = null;
    transport = { socket: null, groupId: undefined };
    loadedItemId = null;
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

    set({
      ...initialState,
      trackPlayerReady: get().trackPlayerReady,
      outputOffsetMs: get().outputOffsetMs,
    });
  },
}));

AsyncStorage.getItem(OFFSET_KEY)
  .then((stored) => {
    const outputOffsetMs = Number(stored);
    if (stored && Number.isFinite(outputOffsetMs))
      useGroupPlaybackStore.setState({ outputOffsetMs });
  })
  .catch(() => {});

function stopDriftChecks() {
  if (driftTimer) clearInterval(driftTimer);
  driftTimer = null;
}

function startDriftChecks() {
  if (driftTimer) return;
  driftTimer = setInterval(() => useGroupPlaybackStore.getState().checkDrift(), DRIFT_CHECK_MS);
}

/** Where this phone's audio should be right now, in seconds. */
function targetNow(outputOffsetMs: number) {
  return roomPositionS(room, serverNow()) + outputOffsetMs / 1000;
}

/** Puts the room's song in the native player, replacing whatever was there. */
function loadRoomSong(item: QueueItem) {
  claimGroupPlayer();
  beginTrackSwap(item.song.id);
  TrackPlayer.stop();
  TrackPlayer.clear();
  TrackPlayer.setMediaItems([useGroupPlaybackStore.getState().convertSongToTrack(item.song)]);
  loadedItemId = item.id;
}

/** Makes the native player match what the room says. Safe to call at any time. */
function align(kind: AlignKind) {
  const store = useGroupPlaybackStore;
  const { trackPlayerReady, outputOffsetMs } = store.getState();
  if (!trackPlayerReady || !room?.item) return;
  const item = room.item;
  clearPendingStart();

  try {
    const alreadyLoaded =
      usePlayerStore.getState().activePlayerMode === 'group' &&
      loadedItemId === item.id &&
      nativeSongId() === item.song.id;

    if (!room.playing) {
      stopDriftChecks();
      markRoomAction();
      setRoomSpeed(1);
      roomToldToPlay = false;
      const target = room.positionMs / 1000;
      if (!alreadyLoaded) loadRoomSong(item);
      else TrackPlayer.pause();
      // A pause lands everyone on the same spot, as a seek does.
      if (
        !alreadyLoaded ||
        Math.abs(TrackPlayer.getProgress().position - target) > ALIGN_TOLERANCE_S
      ) {
        TrackPlayer.seekTo(target);
      }
      store.setState({
        isPlaying: false,
        isLoading: false,
        currentTime: target,
        syncStatus: 'synced',
      });
      return;
    }

    // Back after a dropped connection with the song still going: reloading it would cut the sound
    // when a normal correction is all it needs. Silent with nothing new from the room means it
    // was stopped on this phone (or is buffering), which is left alone too.
    if (alreadyLoaded && (kind === 'join' || kind === 'sync')) {
      if (TrackPlayer.isPlaying() || roomToldToPlay) {
        lastRoomActionAt = 0;
        startDriftChecks();
        return;
      }
    }

    claimGroupPlayer();
    markRoomAction();
    setRoomSpeed(1);
    seekGapMs = SEEK_GAP_MIN_MS;
    seekNotBefore = 0;
    if (!alreadyLoaded) {
      loadRoomSong(item);
      store.setState({ isLoading: true });
    }

    // A start lined up for a moment from now: wait at the starting point, then go with everyone.
    // A new song has already begun downloading, so the wait doubles as a head start.
    const wait = room.anchorAt - serverNow();
    if (wait > 20) {
      const from = room.positionMs / 1000;
      if (alreadyLoaded) {
        if (TrackPlayer.isPlaying()) TrackPlayer.pause();
        if (Math.abs(TrackPlayer.getProgress().position - from) > ALIGN_TOLERANCE_S) {
          TrackPlayer.seekTo(from);
        }
      } else if (from > 0) {
        TrackPlayer.seekTo(from);
      }
      pendingStart = setTimeout(() => {
        pendingStart = null;
        markRoomAction();
        startRoomAudio();
        store.setState({ isPlaying: true, isLoading: false, currentTime: from });
        startDriftChecks();
      }, wait);
      return;
    }

    // The room is already moving: join where it will be once this phone's sound has started.
    const target = targetNow(outputOffsetMs);
    const playing = alreadyLoaded && TrackPlayer.isPlaying();
    if (!alreadyLoaded) {
      TrackPlayer.seekTo(target + aimAhead());
    } else {
      const { position, buffered } = TrackPlayer.getProgress();
      // A resume only seeks if it would be heard to be off, since seeking can make the player
      // stop to buffer. One already playing is left to the drift check.
      if (kind === 'seek' || (!playing && Math.abs(position - target) > ALIGN_TOLERANCE_S)) {
        TrackPlayer.seekTo(target <= buffered ? target : target + aimAhead());
      }
    }
    if (playing) roomToldToPlay = true;
    else startRoomAudio();
    store.setState({ isPlaying: true, isLoading: false, currentTime: target });
    startDriftChecks();
  } catch (error) {
    console.error('Error lining up with the room:', error);
    store.setState({ isLoading: false });
  }
}

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
