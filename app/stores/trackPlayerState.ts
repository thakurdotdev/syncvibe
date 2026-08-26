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
