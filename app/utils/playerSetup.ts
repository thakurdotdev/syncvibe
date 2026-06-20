import { Platform } from 'react-native';
import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  RepeatMode,
} from 'react-native-track-player';

// Function to register service only once
let isServiceRegistered = false;

export function registerPlaybackService() {
  if (isServiceRegistered) {
    return;
  }

  isServiceRegistered = true;

  TrackPlayer.registerPlaybackService(() => require('../service').default);
}

let setupPromise: Promise<boolean> | null = null;
let setupRetryCount = 0;
const MAX_SETUP_RETRIES = 3;

export const setupPlayer = async (): Promise<boolean> => {
  // If setup is already in progress, return the existing promise
  if (setupPromise) {
    return setupPromise;
  }

  // Create a new setup promise
  setupPromise = (async () => {
    try {
      // Check if the player is already initialized by attempting an operation
      try {
        await TrackPlayer.getVolume();
        console.log('TrackPlayer is already initialized');
        return true;
      } catch (error) {
        // Player is not initialized, continue with setup
        console.log('Initializing TrackPlayer...');
      }

      // Setup with optimized configuration for high-quality streaming
      await TrackPlayer.setupPlayer({
        // Increase cache for better offline experience and high-quality streaming
        maxCacheSize: 5 * 1024 * 1024, // 5GB cache for high-quality tracks

        // Optimized buffering for high-quality streaming
        minBuffer: 2,
        maxBuffer: 30,
        playBuffer: 0.5,
        backBuffer: 10,

        // Ensure metadata updates automatically
        autoUpdateMetadata: true,

        // Platform-specific audio settings
        ...(Platform.OS === 'android' && {
          androidAudioContentType: AndroidAudioContentType.Music,
        }),

        ...(Platform.OS === 'ios' && {
          // iOS audio session category
          iosCategory: IOSCategory.Playback,

          // iOS audio session category options
          iosCategoryOptions: [
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.AllowBluetooth,
            IOSCategoryOptions.AllowBluetoothA2DP,
            IOSCategoryOptions.MixWithOthers, // Allow other audio to continue in background
          ],

          // iOS audio session category mode
          iosCategoryMode: IOSCategoryMode.SpokenAudio, // Better for both music and podcasts
        }),

        // Handle audio interruptions automatically
        autoHandleInterruptions: true,
      });

      // Set initial repeat mode
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);

      // Configure capabilities with optimized settings
      await TrackPlayer.updateOptions({
        // Media controls capabilities
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],

        // Capabilities for compact view
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],

        // Notification/Control Center capabilities
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],

        // Android-specific configuration
        android: {
          // Keep playback alive in background
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,

          // Handle audio focus changes gracefully
          alwaysPauseOnInterruption: true,
        },

        progressUpdateEventInterval: 1,
      });

      // Reset retry count on successful setup
      setupRetryCount = 0;

      console.log('TrackPlayer setup complete');
      return true;
    } catch (error) {
      console.error('Error setting up TrackPlayer:', error);

      // Implement retry logic
      setupRetryCount++;
      console.log(`Setup retry count: ${setupRetryCount}`);

      if (setupRetryCount < MAX_SETUP_RETRIES) {
        // Reset the promise so we can try again
        setupPromise = null;

        // Try again after a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return setupPlayer();
      }

      // Reset the promise so we can try again later
      setupPromise = null;
      return false;
    }
  })();

  return setupPromise;
};

/**
 * Helper function to reset the player completely
 * Use this when playback is in a bad state and needs to be reset
 */
export const resetPlayer = async (): Promise<boolean> => {
  try {
    // Reset existing setup
    setupPromise = null;
    setupRetryCount = 0;

    // Try to reset the player if it exists
    try {
      await TrackPlayer.reset();
    } catch (e) {
      // Ignore errors during reset/destroy
    }

    // Setup again
    return setupPlayer();
  } catch (error) {
    console.error('Error resetting player:', error);
    return false;
  }
};
