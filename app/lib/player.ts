import { AppState } from 'react-native';
import type { Socket } from 'socket.io-client';
import { toast } from '@/context/ToastContext';
import { addClockSample, seedClock, serverNow } from '@/stores/groupMusic/roomClock';
import {
  remoteDeviceOf,
  sessionState,
  usePlayerSessionStore,
  type Playback,
  type QueueItem,
} from '@/stores/playerSessionStore';
import {
  setIsRemote,
  setPlayerRouter,
  usePlayerStore,
  type RepeatMode,
} from '@/stores/playerStore';
import {
  bridgeFollow,
  bridgeNativeState,
  bridgeSeek,
  bridgeSetRepeatMode,
  bridgeSilence,
  setBridgeSync,
} from '@/stores/trackPlayerBridge';
import type { Song } from '@/types/song';
import { getDeviceId } from '@/utils/deviceId';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { setPlayEndReason } from '@/utils/playEvents';

/*
 * Your player, shared with your other devices through the server (protocol in
 * server/src/socket/player/handlers.ts). The server owns the queue and which device plays; that
 * device's player is the clock, and it says where it is. Every other device is a remote.
 *
 * While live, what the player store is asked to do (play, skip, add to the queue) goes to the
 * server as a command, and `follow` makes this phone do what the server then says. The native
 * player still moves on by itself when a song ends or a notification button is pressed, even
 * with the app in the background; the bridge tells this module, which tells the server.
 * Offline, the player works on its own as before, and on reconnecting a phone that kept playing
 * takes back what it played if nothing changed elsewhere meanwhile.
 *
 * The web has the same logic in client/src/lib/player.js: change them together.
 */

const COMMAND_TIMEOUT_MS = 8000;
const PING_EVERY_MS = 20000;
/** How often the playing device says where it is, so remotes stay right through stalls. */
const REPORT_EVERY_MS = 10000;
const SEEK_SEND_DELAY_MS = 200;

type Command = { type: string; [key: string]: unknown };
type Reply = { ok?: boolean; error?: string; [key: string]: unknown } | null;

let socket: Socket | null = null;
let pending: Song[] | null = null;
let followed: { songId: string | null; jumps: number | null; active: boolean } = {
  songId: null,
  jumps: null,
  active: false,
};
let pinger: ReturnType<typeof setInterval> | null = null;
let seekTimer: ReturnType<typeof setTimeout> | null = null;
let lastReportAt = 0;

const session = sessionState;
const setSession = (patch: Partial<ReturnType<typeof sessionState>>) =>
  usePlayerSessionStore.setState(patch);
const player = () => usePlayerStore.getState();

const isMe = (device?: { deviceId: string } | null) => device?.deviceId === session().deviceId;
const isActive = () => session().live && isMe(session().playback?.active);
const inRoom = () => player().activePlayerMode === 'group';

/** Whether this phone's player is its own: not while another device is the one playing. */
export const ownsAudio = () => !remoteDeviceOf(session());

export const positionMsOf = (playback: Playback) => {
  const { playing, positionMs, anchorAt } = playback.timeline;
  return playing ? positionMs + Math.max(0, serverNow() - anchorAt) : positionMs;
};

const send = async (command: Command): Promise<Reply> => {
  const quiet = command.type === 'report';
  if (!socket?.connected) {
    if (!quiet) toast("You're offline", { type: 'error' });
    return null;
  }
  try {
    const reply: Reply = await socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emitWithAck('player:cmd', command);
    if (!reply?.ok && !quiet) toast(reply?.error || "That didn't work", { type: 'error' });
    return reply;
  } catch {
    if (!quiet) toast('No answer from the server', { type: 'error' });
    return null;
  }
};

// ── Following the server ────────────────────────────────────────────────────

const songOf = (playback: Playback | null) =>
  playback?.song ? ensureHttpsForSongUrls(playback.song) : null;

const showQueue = () => {
  const songs = session().items.map((item) => ensureHttpsForSongUrls(item.song));
  usePlayerStore.setState({ playlist: songs, originalPlaylist: songs });
};

const follow = () => {
  const { playback, live } = session();
  if (!live || !playback) return;
  const active = isActive();

  // A room has this phone's player. It can't be the one playing your own music meanwhile.
  if (inRoom()) {
    if (active) void send({ type: 'release' });
    followed = { songId: null, jumps: playback.jumps, active: false };
    return;
  }

  const song = songOf(playback);
  const current = player().currentSong;
  usePlayerStore.setState({
    ...(song?.id !== current?.id ? { currentSong: song } : {}),
    shuffleMode: playback.shuffle,
    repeatMode: playback.repeat,
    autoFetchRecommendations: playback.autoplay,
  });

  if (song && active) {
    const jumped = followed.jumps !== playback.jumps || !followed.active;
    // The native player loops a song by itself (and must not move on) on "repeat one".
    bridgeSetRepeatMode(playback.repeat);
    bridgeFollow(song, positionMsOf(playback) / 1000, playback.timeline.playing, jumped);
  } else {
    // Someone else plays, or nobody does: this phone stays silent.
    if (followed.active || bridgeNativeState().playing) bridgeSilence();
    usePlayerStore.setState({
      isPlaying: playback.timeline.playing && !!playback.active,
      isLoading: false,
    });
  }
  followed = { songId: song?.id ?? null, jumps: playback.jumps, active };
};

const applyPlayback = (playback: Playback) => {
  if (!playback) return;
  const held = session().playback;
  if (held && playback.rev < held.rev) return;
  seedClock(playback.serverTime);
  setSession({ playback });
  if (playback.queueRev > session().queueRev) void resync();
  follow();
};

const applyQueue = (queue: { rev: number; items: QueueItem[] }) => {
  if (!queue || queue.rev < session().queueRev) return;
  setSession({ items: queue.items, queueRev: queue.rev });
  showQueue();
};

type QueueEdit =
  | { type: 'add'; index: number; items: QueueItem[] }
  | { type: 'remove'; ids: string[] }
  | { type: 'order'; ids: string[] }
  | { type: 'whole' };

const applyEdit = ({ rev, edit }: { rev: number; edit: QueueEdit }) => {
  const { items, queueRev } = session();
  if (rev <= queueRev) return;
  // Missed one: only the whole queue is safe now.
  if (rev !== queueRev + 1) return void resync();
  let next = items;
  if (edit.type === 'add') {
    next = [...items.slice(0, edit.index), ...edit.items, ...items.slice(edit.index)];
  } else if (edit.type === 'remove') {
    const gone = new Set(edit.ids);
    next = items.filter((item) => !gone.has(item.id));
  } else if (edit.type === 'order') {
    const byId = new Map(items.map((item) => [item.id, item]));
    next = edit.ids.map((id) => byId.get(id)).filter((item): item is QueueItem => !!item);
    if (next.length !== edit.ids.length) return void resync();
  } else return void resync();
  setSession({ items: next, queueRev: rev });
  showQueue();
};

const applySnapshot = (snapshot: any): boolean => {
  if (!snapshot || snapshot.error) return false;
  applyQueue(snapshot.queue);
  setSession({ devices: snapshot.devices ?? [] });
  applyPlayback(snapshot.playback);
  return true;
};

let syncing: Promise<void> | null = null;
const resync = (): Promise<void> => {
  if (!socket?.connected) return Promise.resolve();
  syncing ??= socket
    .timeout(COMMAND_TIMEOUT_MS)
    .emitWithAck('player:sync', {})
    .then(applySnapshot)
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      syncing = null;
    });
  return syncing;
};

const ping = async () => {
  if (!socket?.connected || !session().live) return;
  const sentAt = Date.now();
  try {
    const reply = await socket.timeout(COMMAND_TIMEOUT_MS).emitWithAck('player:ping', {});
    addClockSample(sentAt, reply.serverTime, Date.now());
    const { playback, queueRev } = session();
    if (reply.revs && (reply.revs.playback > (playback?.rev ?? 0) || reply.revs.queue > queueRev)) {
      void resync();
    }
  } catch {
    // The next one will do.
  }
};

/** Where this phone's player is, if it's the one playing. */
const reportPosition = (force = true) => {
  const { playback } = session();
  if (!isActive() || inRoom() || !playback?.song) return;
  const native = bridgeNativeState();
  if (native.songId !== playback.song.id) return;
  const now = Date.now();
  if (!force && now - lastReportAt < REPORT_EVERY_MS) return;
  lastReportAt = now;
  void send({
    type: 'report',
    rev: playback.rev,
    itemId: playback.itemId,
    positionMs: Math.round(native.positionSec * 1000),
    playing: native.playing,
  });
};

// What the native player did by itself.
setBridgeSync({
  ownsAudio: () => !session().live || inRoom() || ownsAudio(),
  /** It moved to another song: a notification button, or the last one ending. */
  moved: (songId) => {
    const { playback, items } = session();
    if (!isActive() || inRoom() || !playback || songId === playback.song?.id) return;
    const itemId = items.find((item) => item.song.id === songId)?.id;
    if (itemId) void send({ type: 'play-item', itemId });
  },
  /** The native queue ran out: the server decides what's next. */
  ended: () => {
    if (!isActive() || inRoom()) return false;
    setPlayEndReason('completed');
    void send({ type: 'ended', itemId: session().playback?.itemId });
    return true;
  },
  changed: () => reportPosition(true),
  progress: () => reportPosition(false),
});

// ── What the player is asked to do ──────────────────────────────────────────

const itemIdOf = (songId: string) => session().items.find((item) => item.song.id === songId)?.id;
const playingNow = () => Boolean(session().playback?.timeline.playing);
const currentPositionMs = () => {
  const { playback } = session();
  return playback ? Math.round(positionMsOf(playback)) : 0;
};

const loadSongs = (songs: Song[], startIndex: number, extra: Record<string, unknown> = {}) =>
  send({ type: 'load', songs, startIndex: Math.max(0, startIndex), ...extra });

/**
 * Screens give the player a list and then say which song to play, one call after the other.
 * The list is held until the end of that same task, so both go to the server as one `load`.
 */
const setPlaylist = (songs: Song[]) => {
  const items = session().items;
  const known = new Map(items.map((item) => [item.song.id, item.id]));
  const allKnown = songs.length > 0 && songs.every((song) => known.has(song.id));

  if (allKnown && songs.length === items.length) {
    usePlayerStore.setState({ playlist: songs });
    void send({ type: 'reorder', itemIds: songs.map((song) => known.get(song.id)) });
    return;
  }
  if (allKnown && songs.length < items.length) {
    const kept = new Set(songs.map((song) => song.id));
    usePlayerStore.setState({ playlist: songs });
    void send({
      type: 'remove',
      itemIds: items.filter((item) => !kept.has(item.song.id)).map((item) => item.id),
    });
    return;
  }

  pending = songs;
  queueMicrotask(() => {
    if (pending !== songs) return;
    pending = null;
    const index = songs.findIndex((song) => song.id === player().currentSong?.id);
    void loadSongs(songs, index, {
      positionMs: index === -1 ? 0 : currentPositionMs(),
      playing: index !== -1 && playingNow(),
    });
  });
};

const playSong = (song: Song) => {
  const list = pending;
  pending = null;
  // Shown at once; the server's answer follows within a moment.
  usePlayerStore.setState({ currentSong: song });
  if (list) {
    void loadSongs(
      list,
      list.findIndex((entry) => entry.id === song.id)
    );
    return;
  }
  const itemId = itemIdOf(song.id);
  if (itemId) void send({ type: 'play-item', itemId });
  else void loadSongs([song], 0);
};

const removeSongs = (songIds: string[]) => {
  const itemIds = songIds.map(itemIdOf).filter(Boolean);
  if (itemIds.length) void send({ type: 'remove', itemIds });
};

const routes: Record<string, (...args: any[]) => unknown> = {
  playSong,
  setPlaylist,
  playPause: () => {
    const playing = isActive() ? bridgeNativeState().playing : playingNow();
    void send({ type: playing ? 'pause' : 'play' });
  },
  next: (isAutoPlay?: boolean) => {
    const { playback } = session();
    if (isAutoPlay === true) {
      if (isActive()) void send({ type: 'ended', itemId: playback?.itemId });
      return;
    }
    setPlayEndReason('next');
    void send({ type: 'next', itemId: playback?.itemId });
  },
  previous: () => {
    setPlayEndReason('previous');
    void send({ type: 'previous' });
  },
  seek: (seconds: number) => {
    if (isActive()) bridgeSeek(seconds);
    if (seekTimer) clearTimeout(seekTimer);
    // Dragging seeks many times a second; the server needs only where it stops.
    seekTimer = setTimeout(
      () => void send({ type: 'seek', positionMs: Math.round(seconds * 1000) }),
      SEEK_SEND_DELAY_MS
    );
  },
  addToQueue: (songs: Song | Song[]) => {
    const list = (Array.isArray(songs) ? songs : [songs]).filter(Boolean);
    if (list.length) void send({ type: 'add', songs: list });
  },
  addRecommendations: (songs: Song[], forSongId: string) => {
    const itemId = itemIdOf(forSongId);
    // Only the device playing picks songs, for the song it's playing.
    if (!isActive() || !itemId || itemId !== session().playback?.itemId) return;
    void send({ type: 'add', autoplay: true, basedOn: itemId, songs });
  },
  removeFromQueue: (songId: string) => removeSongs([songId]),
  removeFromQueueBelow: (songId: string) => {
    const items = session().items;
    const index = items.findIndex((item) => item.song.id === songId);
    if (index !== -1) removeSongs(items.slice(index + 1).map((item) => item.song.id));
  },
  reorder: (songs: Song[]) => setPlaylist(songs),
  clearQueue: () => void send({ type: 'clear' }),
  replaceQueue: (songs: Song[], keepCurrentSong?: boolean) => {
    const current = player().currentSong;
    if (keepCurrentSong && current) {
      void loadSongs([current, ...songs.filter((song) => song.id !== current.id)], 0, {
        positionMs: currentPositionMs(),
        playing: playingNow(),
      });
    } else void loadSongs(songs, 0, { playing: false });
  },
  toggleShuffle: () => void send({ type: 'shuffle', enabled: !session().playback?.shuffle }),
  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const now = session().playback?.repeat ?? 'off';
    void send({ type: 'repeat', mode: modes[(modes.indexOf(now) + 1) % modes.length] });
  },
  setAutoplay: (enabled: boolean) => void send({ type: 'autoplay', enabled: Boolean(enabled) }),
  /** Stopped from the notification, or a room took the player: nothing plays here any more. */
  stop: () => {
    if (!isActive()) return;
    bridgeSilence();
    void send({ type: 'release' });
  },
};

const route = (action: string, ...args: unknown[]) => {
  if (!session().live || !socket?.connected || inRoom() || !routes[action]) return false;
  routes[action](...args);
  return true;
};

/** The seek bar: shared when live, the native player's own otherwise. */
export const seekPlayer = (seconds: number) => {
  if (!route('seek', seconds)) bridgeSeek(seconds);
};

/** Where the playing device is, while that's another one; null when this phone plays. */
export const remoteProgress = () => {
  const { playback } = session();
  // In a room the native player is the room's, whatever your own music is doing elsewhere.
  if (!remoteDeviceOf(session()) || !playback || inRoom()) return null;
  const duration = Number(playback.song?.duration) || 0;
  const position = positionMsOf(playback) / 1000;
  return {
    position: duration > 0 ? Math.min(position, duration) : position,
    duration,
    buffered: 0,
  };
};

// ── Devices ─────────────────────────────────────────────────────────────────

/** "Play here" or "play there". Starts playing if it was paused and you chose this phone. */
export const transferTo = (deviceId: string) =>
  send({ type: 'transfer', deviceId, playing: deviceId === session().deviceId });

// ── The connection ──────────────────────────────────────────────────────────

/** What this phone played while offline, to take back if nothing happened elsewhere meanwhile. */
const resumeOf = () => {
  const { playback } = session();
  const native = bridgeNativeState();
  if (!playback || !isMe(playback.active) || !native.songId || inRoom()) return undefined;
  return {
    rev: playback.rev,
    songId: native.songId,
    positionMs: Math.round(native.positionSec * 1000),
    playing: native.playing,
  };
};

/** The first device to connect brings what it had queued before this existed. */
const seedFromLocal = () => {
  const { playlist, currentSong } = player();
  if (!playlist.length || !currentSong) return;
  const index = playlist.findIndex((song) => song.id === currentSong.id);
  const native = bridgeNativeState();
  const positionSec = native.songId === currentSong.id ? native.positionSec : 0;
  void loadSongs(playlist, index, { positionMs: Math.round(positionSec * 1000), playing: false });
};

const hello = async () => {
  if (!socket?.connected) return;
  const deviceId = await getDeviceId();
  try {
    const snapshot = await socket
      .timeout(COMMAND_TIMEOUT_MS)
      .emitWithAck('player:hello', { deviceId, resume: resumeOf() });
    if (!snapshot || snapshot.error) return;
    setSession({ deviceId, live: true });
    const empty = snapshot.queue?.items?.length === 0;
    applySnapshot(snapshot);
    if (empty) seedFromLocal();
    void ping();
  } catch {
    // Reconnecting will try again; the player works on its own meanwhile.
  }
};

const goOffline = () => setSession({ live: false, devices: [] });

/** Called once the signed-in socket exists. Returns a function that undoes it. */
export const bindPlayerSocket = (newSocket: Socket) => {
  socket = newSocket;
  const handlers: Record<string, (...args: any[]) => void> = {
    connect: () => void hello(),
    disconnect: goOffline,
    'player:playback': applyPlayback,
    'player:queue': applyQueue,
    'player:queue-edit': applyEdit,
    'player:devices': ({ devices }: { devices?: [] }) => setSession({ devices: devices ?? [] }),
  };
  Object.entries(handlers).forEach(([event, handler]) => newSocket.on(event, handler));
  if (newSocket.connected) void hello();
  setPlayerRouter(route);
  setIsRemote(() => !!remoteDeviceOf(session()));
  pinger ??= setInterval(ping, PING_EVERY_MS);

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void ping();
  });
  // Leaving a room gives the player back: catch up with your own music.
  const unsubscribeMode = usePlayerStore.subscribe((state, previous) => {
    if (state.activePlayerMode !== previous.activePlayerMode) follow();
  });

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => newSocket.off(event, handler));
    appState.remove();
    unsubscribeMode();
    setPlayerRouter(null);
    setIsRemote(null);
    if (pinger) clearInterval(pinger);
    pinger = null;
    socket = null;
    pending = null;
    followed = { songId: null, jumps: null, active: false };
    setSession({ live: false, playback: null, items: [], queueRev: 0, devices: [] });
  };
};
