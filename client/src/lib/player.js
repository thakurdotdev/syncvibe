import { toast } from 'sonner';
import { ensureHttpsForDownloadUrls } from '@/Pages/Music/Common';
import { getAudioElement, setPlayerRouter, usePlayerStore } from '@/stores/playerStore';
import { recordPlayEnd, setPlayEndReason } from '@/stores/playEvents';
import { remoteDeviceOf, sessionState, usePlayerSessionStore } from '@/stores/playerSessionStore';
import { getDeviceId } from '@/stores/groupMusic/deviceId';
import { addClockSample, seedClock, serverNow } from '@/stores/groupMusic/roomClock';

/*
 * Your player, shared with your other devices through the server (protocol in
 * server/src/socket/player/handlers.ts). The server owns the queue and which device plays; that
 * device's audio is the clock, and it says where it is. Every other device is a remote.
 *
 * While live, what the player store is asked to do (play, skip, add to the queue) goes to the
 * server as a command, and `follow` makes this tab do what the server then says. Offline, the
 * player works on its own as before, and on reconnecting a tab that kept playing takes back
 * what it played if nothing changed elsewhere meanwhile.
 *
 * The app has the same logic in app/lib/player.ts: change them together.
 */

const COMMAND_TIMEOUT_MS = 8000;
const PING_EVERY_MS = 20000;
/** How often the playing device says where it is, so remotes stay right through stalls. */
const REPORT_EVERY_MS = 10000;
/** A seek on another device moves this one only if it's this far off. */
const SEEK_THRESHOLD_MS = 1000;
const SEEK_SEND_DELAY_MS = 200;

let socket = null;
let pending = null;
let followed = { songId: null, jumps: null, active: false };
let ticker = null;
let pinger = null;
let reporter = null;
let seekTimer = null;

const session = sessionState;
const setSession = (patch) => usePlayerSessionStore.setState(patch);
const player = () => usePlayerStore.getState();

const isMe = (device) => device?.deviceId === session().deviceId;
const isActive = () => session().live && isMe(session().playback?.active);

/** Whether this tab's audio is its own: not while another device is the one playing. */
export const ownsAudio = () => !remoteDeviceOf(session());

const positionMsOf = (playback) => {
  const { playing, positionMs, anchorAt } = playback.timeline;
  return playing ? positionMs + Math.max(0, serverNow() - anchorAt) : positionMs;
};

const send = async (command) => {
  if (!socket?.connected) {
    toast.error("You're offline");
    return null;
  }
  try {
    const reply = await socket.timeout(COMMAND_TIMEOUT_MS).emitWithAck('player:cmd', command);
    if (!reply?.ok && command.type !== 'report') toast.error(reply?.error || "That didn't work");
    return reply;
  } catch {
    if (command.type !== 'report') toast.error('No answer from the server');
    return null;
  }
};

// ── Following the server ────────────────────────────────────────────────────

const songOf = (playback) => (playback?.song ? ensureHttpsForDownloadUrls(playback.song) : null);

const showQueue = () => {
  const songs = session().items.map((item) => ensureHttpsForDownloadUrls(item.song));
  usePlayerStore.setState({ playlist: songs, originalPlaylist: songs });
};

const askToTap = (error) => {
  if (error?.name === 'NotAllowedError') {
    setSession({ needsTap: true });
    // Remotes shouldn't show it playing when it isn't.
    void send({ type: 'pause' });
  }
};

/** This tab plays: make the audio match the server. */
const followAsActive = (playback, song) => {
  const audio = getAudioElement();
  if (!audio) return;
  const positionMs = positionMsOf(playback);
  const playing = playback.timeline.playing;
  const fresh = followed.songId !== song.id || !followed.active;

  if (fresh) {
    player()
      .startAudio(song, {
        positionSec: positionMs / 1000,
        play: playing,
        newPlay: positionMs < 1000,
      })
      .catch(askToTap);
    return;
  }
  if (
    followed.jumps !== playback.jumps &&
    Math.abs(audio.currentTime * 1000 - positionMs) > SEEK_THRESHOLD_MS
  ) {
    audio.currentTime = positionMs / 1000;
  }
  if (playing && audio.paused) audio.play().catch(askToTap);
  if (!playing && !audio.paused) audio.pause();
};

/** Another device plays: keep quiet and show its progress. */
const followAsRemote = (playback, song) => {
  const audio = getAudioElement();
  if (followed.active) recordPlayEnd('closed');
  if (audio && !audio.paused) audio.pause();
  setSession({ needsTap: false });
  usePlayerStore.setState({
    isPlaying: playback.timeline.playing,
    isLoading: false,
    currentTime: positionMsOf(playback) / 1000,
    duration: Number(song?.duration) || 0,
  });
};

const follow = () => {
  const { playback, live } = session();
  if (!live || !playback) return;
  const song = songOf(playback);
  const current = player().currentSong;

  usePlayerStore.setState({
    ...(song?.id !== current?.id ? { currentSong: song } : {}),
    shuffleMode: playback.shuffle,
    repeatMode: playback.repeat,
    autoFetchRecommendations: playback.autoplay,
  });

  const active = isActive();
  if (song && active) followAsActive(playback, song);
  else if (song && playback.active) followAsRemote(playback, song);
  else {
    // Nobody is playing. If this tab was, it stops; either way it gets the song ready, so that
    // pressing play here can start it inside the click, as browsers want.
    const audio = getAudioElement();
    if (followed.active && audio && !audio.paused) audio.pause();
    if (song && followed.songId !== song.id) {
      player()
        .startAudio(song, { positionSec: positionMsOf(playback) / 1000, play: false })
        .catch(() => {});
    }
    usePlayerStore.setState({ isPlaying: false, currentTime: positionMsOf(playback) / 1000 });
  }
  followed = { songId: song?.id ?? null, jumps: playback.jumps, active };
};

const applyPlayback = (playback) => {
  if (!playback) return;
  const held = session().playback;
  if (held && playback.rev < held.rev) return;
  seedClock(playback.serverTime);
  setSession({ playback });
  if (playback.queueRev > session().queueRev) void resync();
  follow();
};

const applyQueue = (queue) => {
  if (!queue || queue.rev < session().queueRev) return;
  setSession({ items: queue.items, queueRev: queue.rev });
  showQueue();
};

const applyEdit = ({ rev, edit }) => {
  const { items, queueRev } = session();
  if (rev <= queueRev) return;
  // Missed one: only the whole queue is safe now.
  if (rev !== queueRev + 1) return void resync();
  let next = items;
  if (edit.type === 'add')
    next = [...items.slice(0, edit.index), ...edit.items, ...items.slice(edit.index)];
  else if (edit.type === 'remove') {
    const gone = new Set(edit.ids);
    next = items.filter((item) => !gone.has(item.id));
  } else if (edit.type === 'order') {
    const byId = new Map(items.map((item) => [item.id, item]));
    next = edit.ids.map((id) => byId.get(id)).filter(Boolean);
    if (next.length !== edit.ids.length) return void resync();
  } else return void resync();
  setSession({ items: next, queueRev: rev });
  showQueue();
};

const applySnapshot = (snapshot) => {
  if (!snapshot || snapshot.error) return false;
  applyQueue(snapshot.queue);
  setSession({ devices: snapshot.devices ?? [] });
  applyPlayback(snapshot.playback);
  return true;
};

let syncing = null;
const resync = () => {
  if (!socket?.connected) return Promise.resolve();
  syncing ??= socket
    .timeout(COMMAND_TIMEOUT_MS)
    .emitWithAck('player:sync', {})
    .then(applySnapshot)
    .catch(() => {})
    .finally(() => (syncing = null));
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

/** Remotes move their progress bar from the server's clock; no updates are needed for it. */
const tick = () => {
  const { playback } = session();
  if (!playback?.timeline.playing || !remoteDeviceOf(session())) return;
  const duration = Number(playback.song?.duration) || Infinity;
  usePlayerStore.setState({ currentTime: Math.min(positionMsOf(playback) / 1000, duration) });
};

/** Where this tab's audio is, if it's the one playing. Called on play, pause and seek too. */
export const reportPosition = () => {
  const { playback } = session();
  const audio = getAudioElement();
  if (!isActive() || !audio || !playback?.song || followed.songId !== playback.song.id) return;
  void send({
    type: 'report',
    rev: playback.rev,
    itemId: playback.itemId,
    positionMs: Math.round(audio.currentTime * 1000),
    playing: !audio.paused,
  });
};

// ── What the player is asked to do ──────────────────────────────────────────

const itemIdOf = (songId) => session().items.find((item) => item.song.id === songId)?.id;

const playingNow = () => Boolean(session().playback?.timeline.playing);

/** Plays a list: one that `setPlaylist` was just given, or the song on its own. */
const loadSongs = (songs, startIndex, extra = {}) =>
  send({ type: 'load', songs, startIndex: Math.max(0, startIndex), ...extra });

/**
 * Pages give the player a list and then say which song to play, one call after the other. The
 * list is held until the end of that same task, so both go to the server as one `load`.
 */
const setPlaylist = (songs) => {
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
      positionMs: index === -1 ? 0 : positionMsOf(session().playback),
      playing: index !== -1 && playingNow(),
    });
  });
};

const playSong = (song) => {
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

const playPause = () => {
  const audio = getAudioElement();
  const playing = isActive() ? Boolean(audio && !audio.paused) : playingNow();
  // Straight away on this tab, inside the click, which is what lets a browser start sound.
  if (ownsAudio() && audio?.src) {
    if (playing) audio.pause();
    else audio.play().catch(() => {});
    setSession({ needsTap: false });
  }
  void send({ type: playing ? 'pause' : 'play' });
};

const routes = {
  // The audio follows the server instead (see `follow`).
  loadCurrent: () => true,
  playSong,
  setPlaylist,
  playPause,
  next: (isAutoPlay) => {
    const { playback } = session();
    if (isAutoPlay === true) {
      // Only the device playing says a song ended.
      if (isActive()) void send({ type: 'ended', itemId: playback?.itemId });
      setPlayEndReason('completed');
      return;
    }
    setPlayEndReason('next');
    void send({ type: 'next', itemId: playback?.itemId });
  },
  previous: () => {
    setPlayEndReason('previous');
    void send({ type: 'previous' });
  },
  seek: (seconds) => {
    const audio = getAudioElement();
    if (isActive() && audio) audio.currentTime = seconds;
    usePlayerStore.setState({ currentTime: seconds });
    // Dragging the bar seeks many times a second; the server needs only where it stops.
    clearTimeout(seekTimer);
    seekTimer = setTimeout(
      () => void send({ type: 'seek', positionMs: Math.round(seconds * 1000) }),
      SEEK_SEND_DELAY_MS
    );
  },
  addToQueue: (songs) => {
    const list = (Array.isArray(songs) ? songs : [songs]).filter(Boolean);
    if (list.length) void send({ type: 'add', songs: list });
  },
  addRecommendations: (songs, forSongId) => {
    const itemId = itemIdOf(forSongId);
    if (!isActive() || !itemId || itemId !== session().playback?.itemId) return;
    void send({ type: 'add', autoplay: true, basedOn: itemId, songs });
  },
  removeFromQueueBelow: (songId) => {
    const items = session().items;
    const index = items.findIndex((item) => item.song.id === songId);
    const itemIds = index === -1 ? [] : items.slice(index + 1).map((item) => item.id);
    if (itemIds.length) void send({ type: 'remove', itemIds });
  },
  clearQueue: () => void send({ type: 'clear' }),
  replaceQueue: (songs, keepCurrentSong) => {
    const list = Array.isArray(songs) ? songs : [songs];
    const current = player().currentSong;
    if (keepCurrentSong && current) {
      void loadSongs([current, ...list.filter((song) => song.id !== current.id)], 0, {
        positionMs: positionMsOf(session().playback),
        playing: playingNow(),
      });
    } else void loadSongs(list, 0, { playing: false });
  },
  toggleShuffle: () => void send({ type: 'shuffle', enabled: !session().playback?.shuffle }),
  toggleRepeat: () => {
    const modes = ['off', 'all', 'one'];
    const now = session().playback?.repeat ?? 'off';
    void send({ type: 'repeat', mode: modes[(modes.indexOf(now) + 1) % modes.length] });
  },
  setAutoplay: (enabled) => void send({ type: 'autoplay', enabled: Boolean(enabled) }),
  stop: () => {
    if (!isActive()) return;
    getAudioElement()?.pause();
    void send({ type: 'pause' });
  },
};

const route = (action, ...args) => {
  if (!session().live || !socket?.connected || !routes[action]) return false;
  routes[action](...args);
  return true;
};

// ── Devices ─────────────────────────────────────────────────────────────────

/** "Play here" or "play there". Starts playing if it was paused and you chose this tab. */
export const transferTo = async (deviceId) => {
  const here = deviceId === session().deviceId;
  // Inside the click: lets this tab start sound when the answer comes back.
  if (here)
    getAudioElement()
      ?.play()
      .catch(() => {});
  return send({ type: 'transfer', deviceId, playing: here });
};

/** The browser blocked sound when playback moved here; this is the tap it was waiting for. */
export const resumeAfterTap = () => {
  setSession({ needsTap: false });
  getAudioElement()
    ?.play()
    .then(() => send({ type: 'play' }))
    .catch(() => {});
};

// ── The connection ──────────────────────────────────────────────────────────

/** What this tab played while offline, to take back if nothing happened elsewhere meanwhile. */
const resumeOf = () => {
  const { playback } = session();
  const audio = getAudioElement();
  const song = player().currentSong;
  if (!playback || !isMe(playback.active) || !audio || !song) return undefined;
  return {
    rev: playback.rev,
    songId: song.id,
    positionMs: Math.round(audio.currentTime * 1000),
    playing: !audio.paused,
  };
};

/** The first device to connect brings what it had queued before this existed. */
const seedFromLocal = () => {
  const { playlist, currentSong, currentTime } = player();
  if (!playlist.length || !currentSong) return;
  const index = playlist.findIndex((song) => song.id === currentSong.id);
  void loadSongs(playlist, index, { positionMs: Math.round(currentTime * 1000), playing: false });
};

const hello = async () => {
  if (!socket?.connected) return;
  const deviceId = getDeviceId();
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

const goOffline = () => {
  setSession({ live: false, devices: [] });
};

const startTimers = () => {
  ticker ??= setInterval(tick, 500);
  pinger ??= setInterval(ping, PING_EVERY_MS);
  reporter ??= setInterval(() => {
    if (getAudioElement() && !getAudioElement().paused) reportPosition();
  }, REPORT_EVERY_MS);
};

const stopTimers = () => {
  [ticker, pinger, reporter].forEach((timer) => timer && clearInterval(timer));
  ticker = pinger = reporter = null;
};

const onVisible = () => {
  if (document.visibilityState === 'visible') void ping();
};

/** Called once the signed-in socket exists. Returns a function that undoes it. */
export const bindPlayerSocket = (newSocket) => {
  socket = newSocket;
  const handlers = {
    connect: hello,
    disconnect: goOffline,
    'player:playback': applyPlayback,
    'player:queue': applyQueue,
    'player:queue-edit': applyEdit,
    'player:devices': ({ devices }) => setSession({ devices: devices ?? [] }),
  };
  Object.entries(handlers).forEach(([event, handler]) => newSocket.on(event, handler));
  if (newSocket.connected) void hello();
  setPlayerRouter(route);
  startTimers();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => newSocket.off(event, handler));
    document.removeEventListener('visibilitychange', onVisible);
    setPlayerRouter(null);
    stopTimers();
    socket = null;
    pending = null;
    followed = { songId: null, jumps: null, active: false };
    usePlayerSessionStore.setState({
      live: false,
      playback: null,
      items: [],
      queueRev: 0,
      devices: [],
      needsTap: false,
    });
  };
};
