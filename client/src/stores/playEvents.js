const API_URL = import.meta.env.VITE_API_URL;
const QUEUE_KEY = 'play-events-queue';
const MAX_QUEUED_EVENTS = 200;
const BATCH_SIZE = 50;
/** The browser only lets a closing page send a small request. */
const CLOSING_PAGE_BATCH_SIZE = 20;
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000;
/** A longer jump between time updates is a seek, which isn't listening. */
const MAX_TICK_SECONDS = 5;

let enabled = false;
let active = null;
let pendingEndReason = null;
let sessionId = null;
let lastActivityAt = 0;
let isFlushing = false;
const recommendations = new Map();

const currentSessionId = () => {
  const now = Date.now();
  if (!sessionId || now - lastActivityAt > NEW_SESSION_AFTER_MS) {
    sessionId = crypto.randomUUID();
  }
  lastActivityAt = now;
  return sessionId;
};

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
};

const writeQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving play events:', error);
  }
};

const send = (events, keepalive = false) =>
  fetch(`${API_URL}/api/play-events`, {
    method: 'POST',
    credentials: 'include',
    keepalive,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });

/** Sends saved events. Anything that fails stays saved and goes with the next attempt. */
export const flushPlayEvents = async () => {
  if (isFlushing) return;
  isFlushing = true;
  try {
    while (true) {
      const batch = readQueue().slice(0, BATCH_SIZE);
      if (batch.length === 0) return;
      const response = await send(batch);
      // The server refused this batch and will refuse it again, so don't retry it forever.
      const rejected = response.status === 400 || response.status === 413;
      if (!response.ok && !rejected) return;
      // Read again: a song may have ended while this batch was being sent.
      const sent = new Set(batch.map((event) => event.eventId));
      writeQueue(readQueue().filter((event) => !sent.has(event.eventId)));
    }
  } catch {
    // Offline: the events stay saved.
  } finally {
    isFlushing = false;
  }
};

const inferEndReason = (play) => {
  if (pendingEndReason) return pendingEndReason;
  return play.playedMs > 0 ? 'next' : 'selected';
};

const save = (play, endReason) => {
  const { lastPositionSeconds: _position, ...event } = play;
  writeQueue([...readQueue(), { ...event, endReason }].slice(-MAX_QUEUED_EVENTS));
};

const begin = (song, source, positionSeconds = 0) => {
  const recommendation = recommendations.get(song.id);
  const isRecommendation = source !== 'resume' && !!recommendation;
  active = {
    eventId: crypto.randomUUID(),
    songId: song.id,
    sessionId: currentSessionId(),
    source: isRecommendation ? 'recommendation' : source,
    seedSongId: isRecommendation ? recommendation.seedSongId : null,
    position: isRecommendation ? recommendation.position : null,
    startedAt: new Date().toISOString(),
    playedMs: 0,
    durationMs: song.duration ? Number(song.duration) * 1000 : null,
    lastPositionSeconds: positionSeconds,
    platform: 'web',
  };
  pendingEndReason = null;
};

/** Only logged-in listens are recorded. */
export const setPlayEventsEnabled = (value) => {
  enabled = value;
  if (value) {
    flushPlayEvents();
  } else {
    active = null;
    pendingEndReason = null;
  }
};

/** Says why the current song is about to change, ahead of the change itself. */
export const setPlayEndReason = (reason, keepExisting = false) => {
  if (keepExisting && pendingEndReason) return;
  pendingEndReason = reason;
};

/** Remembers which songs came from a recommendation, to credit them if they're played. */
export const markRecommendations = (seedSongId, songs) => {
  songs.forEach((song, position) => recommendations.set(song.id, { seedSongId, position }));
};

export const recordPlayStart = (song) => {
  if (!enabled) return;
  if (active?.songId === song.id) {
    pendingEndReason = null;
    return;
  }
  const previousReason = pendingEndReason;
  if (active) {
    save(active, inferEndReason(active));
    flushPlayEvents();
  }
  const movedThroughQueue = previousReason === 'next' || previousReason === 'completed';
  begin(song, movedThroughQueue ? 'queue' : 'direct');
};

export const recordPlayProgress = (song, positionSeconds) => {
  if (!enabled || !song?.id) return;
  // Picked up without a song change: a restored song, or playing again after closing.
  if (!active) begin(song, 'resume', positionSeconds);
  // The audio element can report the old song's time just after a song change.
  if (active.songId !== song.id) return;

  const delta = positionSeconds - active.lastPositionSeconds;
  if (delta > 0 && delta <= MAX_TICK_SECONDS) active.playedMs += Math.round(delta * 1000);
  active.lastPositionSeconds = positionSeconds;
  lastActivityAt = Date.now();
};

export const recordPlayEnd = (reason) => {
  if (active) {
    save(active, reason);
    flushPlayEvents();
  }
  active = null;
  pendingEndReason = null;
};

/** The tab is going away, so a normal request might not finish. */
export const recordPageClosing = () => {
  if (active) save(active, 'closed');
  active = null;
  pendingEndReason = null;

  const queue = readQueue();
  if (queue.length === 0) return;
  const batch = queue.slice(0, CLOSING_PAGE_BATCH_SIZE);
  // A batch that also goes out with the next visit's flush is ignored by its event IDs.
  send(batch, true).catch(() => {});
};
