import TrackPlayer, { PlayerCommand } from '@rntp/player';

let isSetup = false;

export const setupPlayer = (): boolean => {
  if (isSetup) return true;

  try {
    TrackPlayer.setupPlayer({
      contentType: 'music',
      handleAudioBecomingNoisy: true,
      cache: {
        maxSizeBytes: 500 * 1024 * 1024,
        preloading: { window: 1 },
      },
      android: {
        wakeMode: 'network',
        taskRemovedBehavior: 'stop',
        notification: {
          channelId: 'com.thakurdotdev.syncvibe.playback',
          channelName: 'SyncVibe',
          smallIcon: 'ic_launcher',
        },
      },
    });

    TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,
        PlayerCommand.Next,
        PlayerCommand.Previous,
        PlayerCommand.Seek,
        PlayerCommand.Stop,
      ],
      handling: 'native',
    });

    isSetup = true;
    return true;
  } catch (error: any) {
    if (error?.message?.includes('already set up') || error?.message?.includes('should only be called once')) {
      isSetup = true;
      return true;
    }
    console.error('Error setting up TrackPlayer:', error);
    return false;
  }
};

export const resetPlayer = (): boolean => {
  try {
    TrackPlayer.clear();
    return true;
  } catch (error) {
    console.error('Error resetting player:', error);
    return false;
  }
};
