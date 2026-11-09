import { toast } from 'sonner';
import { create } from 'zustand';
import { clockQuality, resetClock, serverNow } from './roomClock';
import { sendRoomCommand } from './roomProtocol';
import { DRIFT_CHECK_MS, planCorrection, roomPositionS, syncStatusOf } from './roomSync';

/*
 * Playing the room's song in step with everyone else.
 *
 * The server keeps one timeline: a position at a moment of its clock. This tab knows that clock
 * (see roomClock), so at any instant it can work out where the song should be without asking.
 *  - A change from the room (new song, play, pause, seek) is applied the moment it arrives. Starts
 *    are scheduled slightly ahead, so every device begins at the same instant.
 *  - Once a second the tab compares its audio with the timeline. A small gap closes by playing up
 *    to 5% fast or slow, which doesn't interrupt the sound; a large one takes a seek.
 * The tab never tells other devices where the song is. It only asks the server for changes.
 */

const OFFSET_KEY = 'syncvibe_room_audio_offset';
export const MAX_OUTPUT_OFFSET_MS = 500;
/** After pausing or seeking here, leave the audio alone until the room has caught up with it. */
const LOCAL_ACTION_HOLD_MS = 1500;
const SEEK_DEBOUNCE_MS = 150;
/**
 * A seek that doesn't settle things (the audio there still has to download) waits longer before
 * the next, so a slow connection can't seek in a loop.
 */
const SEEK_GAP_MIN_MS = 4000;
const SEEK_GAP_MAX_MS = 30000;
/** A paused or just-resumed player lines up exactly; a playing one is left to the drift check. */
const ALIGN_TOLERANCE_S = 0.05;

let audioElement = null;
/** The room's playback as last told: { rev, item, playing, positionMs, anchorAt }. */
let room = null;
let transport = { socket: null, groupId: null };
let loadedItemId = null;
let startTimer = null;
let driftTimer = null;
let seekDebounceTimer = null;
let holdUntil = 0;
let seekNotBefore = 0;
let seekGapMs = SEEK_GAP_MIN_MS;
const preloadedAudios = new Map();

const readOutputOffset = () => {
  try {
    const stored = Number(localStorage.getItem(OFFSET_KEY));
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return 0;
  }
};

const getSongUrl = (song) =>
  song?.download_url?.find((u) => u.quality === '320kbps')?.link ||
  song?.download_url?.[3]?.link ||
  song?.download_url?.at?.(-1)?.link;

const preloadSong = (song) => {
  if (!song) return;
  const url = getSongUrl(song);
  if (!url || preloadedAudios.has(song.id)) return;

  // Fetching it once puts it in the browser's cache, which the real player then reads from.
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;

  if (preloadedAudios.size >= 2) {
    const oldest = preloadedAudios.keys().next().value;
    preloadedAudios.get(oldest).src = '';
    preloadedAudios.delete(oldest);
  }
  preloadedAudios.set(song.id, audio);
};

const clearStart = () => {
  if (startTimer) clearTimeout(startTimer);
  startTimer = null;
};

const stopDriftChecks = () => {
  if (driftTimer) clearInterval(driftTimer);
  driftTimer = null;
};

export const useGroupPlaybackStore = create((set, get) => {
  /** Where this tab's audio should be right now, in seconds. */
  const targetNow = () => roomPositionS(room, serverNow()) + get().outputOffsetMs / 1000;

  const setRate = (rate) => {
    if (audioElement && audioElement.playbackRate !== rate) audioElement.playbackRate = rate;
  };

  const setStatus = (syncStatus) => {
    if (get().syncStatus !== syncStatus) set({ syncStatus });
  };

  const playAudio = () => {
    if (!audioElement?.paused) return;
    audioElement.play().then(
      () => {
        if (get().needsGesture) set({ needsGesture: false });
      },
      (err) => {
        // Browsers only let a page start sound after a click or key press on it, which a reload
        // that rejoins a room hasn't had.
        if (err?.name === 'NotAllowedError') set({ needsGesture: true });
      }
    );
  };

  const checkDrift = () => {
    if (!audioElement || !room?.playing || !room.item || startTimer) return;
    if (get().needsGesture || Date.now() < holdUntil || audioElement.ended) return;

    // Something other than the room stopped it (the browser, a headset button): pick it back up.
    if (audioElement.paused) {
      audioElement.currentTime = targetNow();
      playAudio();
      return;
    }
    // Buffering. Its position means nothing until sound is coming out again.
    if (audioElement.seeking || audioElement.readyState < 3) {
      setRate(1);
      setStatus('catching-up');
      return;
    }

    const expected = targetNow();
    const duration = audioElement.duration || 0;
    if (duration && expected >= duration - 0.5) {
      setRate(1);
      return;
    }

    const drift = expected - audioElement.currentTime;
    const plan = planCorrection(drift, { canSeek: Date.now() >= seekNotBefore });
    if (plan.type === 'seek') {
      seekNotBefore = Date.now() + seekGapMs;
      seekGapMs = Math.min(seekGapMs * 2, SEEK_GAP_MAX_MS);
      audioElement.currentTime = expected;
    } else if (plan.type === 'hold') {
      seekGapMs = SEEK_GAP_MIN_MS;
    }
    setRate(plan.rate);
    setStatus(syncStatusOf(drift));
  };

  const startDriftChecks = () => {
    if (!driftTimer) driftTimer = setInterval(checkDrift, DRIFT_CHECK_MS);
  };

  /** Joins the timeline where it is now. */
  const startAudio = (forceSeek) => {
    if (!audioElement || !room?.playing) return;
    const target = targetNow();
    const off = Math.abs(audioElement.currentTime - target);
    if (forceSeek || (audioElement.paused && off > ALIGN_TOLERANCE_S)) {
      audioElement.currentTime = target;
    }
    playAudio();
    startDriftChecks();
  };

  /** Makes the audio match what the room says. Safe to call at any time. */
  const align = (kind) => {
    clearStart();
    if (!audioElement || !room?.item) return;
    holdUntil = 0;
    setRate(1);

    if (!room.playing) {
      stopDriftChecks();
      if (!audioElement.paused) audioElement.pause();
      const target = room.positionMs / 1000;
      if (Math.abs(audioElement.currentTime - target) > ALIGN_TOLERANCE_S) {
        audioElement.currentTime = target;
      }
      set({ isPlaying: false, isSyncing: false, currentTime: target, syncStatus: 'synced' });
      return;
    }

    set({ isPlaying: true });
    seekGapMs = SEEK_GAP_MIN_MS;
    seekNotBefore = 0;

    // A start lined up for a moment from now: wait at the starting point, then go with everyone.
    const wait = room.anchorAt - serverNow();
    if (wait > 20) {
      if (!audioElement.paused) audioElement.pause();
      audioElement.currentTime = room.positionMs / 1000;
      if (kind === 'track') set({ isSyncing: true });
      startTimer = setTimeout(() => {
        startTimer = null;
        set({ isSyncing: false });
        startAudio(false);
      }, wait);
      return;
    }

    set({ isSyncing: false });
    startAudio(kind === 'seek');
  };

  const loadItem = (item) => {
    const url = getSongUrl(item.song);
    loadedItemId = item.id;
    if (!audioElement) return;

    audioElement.onloadedmetadata = () => {
      set({ duration: audioElement.duration, isLoading: false });
    };
    audioElement.oncanplay = () => {
      if (get().isLoading) set({ isLoading: false });
    };
    audioElement.ontimeupdate = () => {
      set({ currentTime: audioElement.currentTime });
    };
    audioElement.onerror = () => {
      if (loadedItemId !== item.id) return;
      set({ isLoading: false });
      toast.error('Failed to load audio');
    };
    audioElement.onended = () => {
      // The room moves on by itself; this just lets it do so the moment the sound stops.
      if (audioElement.currentTime < 1) return;
      sendRoomCommand(transport.socket, transport.groupId, 'ended', { itemId: item.id });
    };

    preloadedAudios.delete(item.song?.id);
    set({ isLoading: true, currentTime: 0, duration: Number(item.song?.duration) || 0 });
    if (!url) {
      set({ isLoading: false });
      toast.error('This song has no audio to play');
      return;
    }
    audioElement.src = url;
    audioElement.load();
    audioElement.volume = get().volume;
  };

  const unloadAudio = () => {
    loadedItemId = null;
    if (!audioElement) return;
    audioElement.pause();
    audioElement.playbackRate = 1;
    audioElement.removeAttribute('src');
    audioElement.load();
  };

  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentSong: null,
    volume: 1,
    isLoading: false,
    isSyncing: false,
    syncCountdown: 0,
    lastSync: 0,
    connectionQuality: 'good',
    /** How closely this tab is following the room: 'synced', 'adjusting' or 'catching-up'. */
    syncStatus: 'synced',
    /** The browser is waiting for a click before it will play sound. */
    needsGesture: false,
    /**
     * Plays this much ahead of the room (negative: behind), to make up for speakers that add
     * their own delay, such as Bluetooth ones. Kept per browser.
     */
    outputOffsetMs: readOutputOffset(),

    setAudioRef: (el) => {
      audioElement = el;
    },

    /** Where to send what this tab's player reports, such as a song ending. */
    setTransport: (socket, groupId) => {
      transport = { socket, groupId };
    },

    formatTime: (seconds) => {
      if (!seconds) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    preloadUpcoming: (upcoming = []) => {
      upcoming.slice(0, 2).forEach((item) => preloadSong(item?.song));
    },

    getPlaybackRev: () => room?.rev ?? 0,

    /**
     * The room's playback changed (or this tab is joining it). Each one replaces what was known,
     * so an older message arriving late is dropped rather than applied over a newer one.
     */
    applyPlayback: (part, kind, { force = false } = {}) => {
      if (!part || typeof part.rev !== 'number') return false;
      if (!force && room && part.rev <= room.rev) return false;
      room = {
        rev: part.rev,
        item: part.item || null,
        playing: Boolean(part.playing),
        positionMs: part.positionMs || 0,
        anchorAt: part.anchorAt || 0,
      };

      if (!room.item) {
        clearStart();
        stopDriftChecks();
        unloadAudio();
        set({
          currentSong: null,
          isPlaying: false,
          isLoading: false,
          isSyncing: false,
          currentTime: 0,
          duration: 0,
          syncStatus: 'synced',
        });
        return true;
      }

      if (room.item.id !== loadedItemId) loadItem(room.item);
      if (get().currentSong?.id !== room.item.song?.id) set({ currentSong: room.item.song });
      align(kind);
      return true;
    },

    /** A ping came back: the clock may have moved, so the connection readout is refreshed. */
    noteClockUpdate: () => {
      const connectionQuality = clockQuality();
      if (get().connectionQuality !== connectionQuality) set({ connectionQuality });
    },

    /** Call from a click, once the browser has refused to start sound on its own. */
    resumeAudio: () => {
      set({ needsGesture: false });
      if (room?.playing) startAudio(true);
    },

    handlePlayPause: async (socket, groupId, forceState) => {
      if (!audioElement || !groupId || !room?.item) return;
      const play = typeof forceState === 'boolean' ? forceState : !get().isPlaying;

      if (play && get().needsGesture) set({ needsGesture: false });
      // A pause is felt at once; the room's answer then settles the exact spot for everyone.
      if (!play) {
        clearStart();
        holdUntil = Date.now() + LOCAL_ACTION_HOLD_MS;
        audioElement.pause();
        set({ isPlaying: false });
      }

      const result = await sendRoomCommand(socket, groupId, play ? 'play' : 'pause');
      if (!result.ok) {
        toast.error(result.error);
        align();
      }
    },

    handleSeek: (socket, groupId, value) => {
      if (!audioElement || !groupId || !room?.item) return;
      const newTime = Array.isArray(value) ? value[0] : value;

      holdUntil = Date.now() + LOCAL_ACTION_HOLD_MS;
      audioElement.currentTime = newTime;
      set({ currentTime: newTime });

      if (seekDebounceTimer) clearTimeout(seekDebounceTimer);
      seekDebounceTimer = setTimeout(async () => {
        seekDebounceTimer = null;
        const result = await sendRoomCommand(socket, groupId, 'seek', {
          positionMs: Math.round(newTime * 1000),
        });
        if (!result.ok) {
          toast.error(result.error);
          align('seek');
        }
      }, SEEK_DEBOUNCE_MS);
    },

    handleVolumeChange: (value) => {
      const newVolume = value[0];
      set({ volume: newVolume });
      if (audioElement) audioElement.volume = newVolume;
    },

    setOutputOffset: (ms) => {
      const outputOffsetMs = Math.max(
        -MAX_OUTPUT_OFFSET_MS,
        Math.min(MAX_OUTPUT_OFFSET_MS, Math.round(Number(ms) || 0))
      );
      set({ outputOffsetMs });
      try {
        localStorage.setItem(OFFSET_KEY, String(outputOffsetMs));
      } catch {
        // Private mode: it still applies until the tab closes.
      }
    },

    updateMediaSession: (song, playPauseFn, skipFn) => {
      if (!('mediaSession' in navigator)) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: song?.artist_map?.artists
          ?.slice(0, 3)
          ?.map((a) => a.name)
          .join(', '),
        album: song?.album,
        artwork: song.image?.[2]?.link
          ? [{ src: song.image[2].link, sizes: '500x500', type: 'image/jpeg' }]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => playPauseFn(true));
      navigator.mediaSession.setActionHandler('pause', () => playPauseFn(false));
      navigator.mediaSession.setActionHandler('nexttrack', skipFn);

      document.title = `${song.name} - SyncVibe`;
    },

    reset: () => {
      clearStart();
      stopDriftChecks();
      if (seekDebounceTimer) clearTimeout(seekDebounceTimer);
      seekDebounceTimer = null;
      room = null;
      transport = { socket: null, groupId: null };
      holdUntil = 0;
      unloadAudio();
      for (const audio of preloadedAudios.values()) audio.src = '';
      preloadedAudios.clear();
      resetClock();
      set({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        currentSong: null,
        isLoading: false,
        isSyncing: false,
        syncCountdown: 0,
        syncStatus: 'synced',
        needsGesture: false,
        connectionQuality: 'good',
      });
    },
  };
});
