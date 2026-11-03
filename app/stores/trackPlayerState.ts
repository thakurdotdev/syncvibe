/**
 * Shared flag that tracks whether the native TrackPlayer has been
 * initialized. Lives in its own module to break the circular dependency
 * between trackPlayerBridge and groupPlaybackStore.
 */
let _initialized = false;

export const setTrackPlayerReady = (ready: boolean) => {
  _initialized = ready;
};

export const isTrackPlayerReady = () => _initialized;

/**
 * Where your own song should pick up the next time it loads into the native player.
 * Set when the app restores your last song and when a room takes over the player, so
 * pressing play later continues from there instead of starting the song over.
 */
let resumePoint: { songId: string; position: number } | null = null;

export const setResumePoint = (songId: string, position: number) => {
  resumePoint = position > 0 ? { songId, position } : null;
};

/** Returns the saved position for `songId` (0 if none) and clears it: a resume is one-shot. */
export const takeResumePoint = (songId: string): number => {
  const point = resumePoint;
  resumePoint = null;
  return point?.songId === songId ? point.position : 0;
};
