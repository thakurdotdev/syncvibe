export const MAX_EVENTS_PER_REQUEST = 50;

const SOURCES = ['direct', 'queue', 'recommendation', 'resume'] as const;
const END_REASONS = ['completed', 'next', 'previous', 'selected', 'closed', 'error'] as const;
const PLATFORMS = ['app', 'web'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKIP_UNDER_MS = 30_000;
const MAX_PLAYED_MS = 6 * 60 * 60 * 1000;
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export interface PlayEventInput {
  eventId: string;
  songId: string;
  sessionId: string;
  source: (typeof SOURCES)[number];
  seedSongId: string | null;
  position: number | null;
  startedAt: Date;
  playedMs: number;
  durationMs: number | null;
  endReason: (typeof END_REASONS)[number];
  platform: (typeof PLATFORMS)[number];
}

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  allowed.includes(value as T) ? (value as T) : null;

const toWholeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 255;

/** Returns a clean event, or null if it can't be trusted. Clients are never fully current. */
export const parsePlayEvent = (raw: unknown, now = Date.now()): PlayEventInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as Record<string, unknown>;

  const source = oneOf(SOURCES, event.source);
  const endReason = oneOf(END_REASONS, event.endReason);
  const platform = oneOf(PLATFORMS, event.platform);
  const playedMs = toWholeNumber(event.playedMs);
  const startedAt = new Date(event.startedAt as string);

  if (
    typeof event.eventId !== 'string' ||
    !UUID.test(event.eventId) ||
    typeof event.sessionId !== 'string' ||
    !UUID.test(event.sessionId) ||
    !isId(event.songId) ||
    !source ||
    !endReason ||
    !platform ||
    playedMs === null ||
    Number.isNaN(startedAt.getTime()) ||
    startedAt.getTime() > now + MAX_CLOCK_SKEW_MS ||
    startedAt.getTime() < now - MAX_EVENT_AGE_MS
  ) {
    return null;
  }

  return {
    eventId: event.eventId,
    songId: event.songId,
    sessionId: event.sessionId,
    source,
    seedSongId: isId(event.seedSongId) ? event.seedSongId : null,
    position: toWholeNumber(event.position),
    startedAt,
    playedMs: Math.min(playedMs, MAX_PLAYED_MS),
    durationMs: toWholeNumber(event.durationMs),
    endReason,
    platform,
  };
};

/** Pressed next early. Picking another song isn't counted: that's choosing, not rejecting. */
export const isSkip = (event: Pick<PlayEventInput, 'endReason' | 'playedMs'>): boolean =>
  event.endReason === 'next' && event.playedMs < SKIP_UNDER_MS;

export const completionPercent = (playedMs: number, durationMs: number | null): number =>
  durationMs && durationMs > 0 ? Math.min((playedMs / durationMs) * 100, 100) : 0;
