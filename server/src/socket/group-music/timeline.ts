/**
 * The room's clock. One position at one moment of server time is all anyone needs to know where
 * the song is at any other moment, so devices follow this instead of following each other.
 */
export interface Timeline {
  playing: boolean;
  /** Where the song is (or was paused) at `anchorAt`. */
  positionMs: number;
  /** Server time the position belongs to. In the future while a start is being lined up. */
  anchorAt: number;
}

export const STOPPED: Timeline = { playing: false, positionMs: 0, anchorAt: 0 };

export const positionAt = (timeline: Timeline, now: number): number =>
  timeline.playing
    ? timeline.positionMs + Math.max(0, now - timeline.anchorAt)
    : timeline.positionMs;

/** Starts (or resumes) from a position, `leadMs` from now so every device can begin together. */
export const playFrom = (positionMs: number, now: number, leadMs = 0): Timeline => ({
  playing: true,
  positionMs: Math.max(0, positionMs),
  anchorAt: now + leadMs,
});

export const pausedAt = (positionMs: number, now: number): Timeline => ({
  playing: false,
  positionMs: Math.max(0, positionMs),
  anchorAt: now,
});

/** Milliseconds until a song of this length ends, or null if it isn't moving or has no length. */
export const msUntilEnd = (timeline: Timeline, durationMs: number, now: number): number | null => {
  if (!timeline.playing || durationMs <= 0) return null;
  return Math.max(0, durationMs - timeline.positionMs + (timeline.anchorAt - now));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * How far ahead to schedule a start. Long enough for the news to reach the slowest device (and,
 * for a new song, for it to start downloading), short enough to feel immediate.
 */
export const leadFor = (kind: 'track' | 'resume', slowestRttMs: number | null): number => {
  if (kind === 'track') {
    return slowestRttMs === null ? 800 : clamp(slowestRttMs * 1.5 + 300, 500, 1500);
  }
  return slowestRttMs === null ? 250 : clamp(slowestRttMs + 60, 120, 500);
};
