import TrackPlayer, { Event, State } from 'react-native-track-player';
import { getPlaybackState } from 'react-native-track-player/lib/src/trackPlayer';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await TrackPlayer.play();
      console.log('Remote play triggered');
    } catch (error) {
      console.error('Remote play error:', error);
      setTimeout(() => TrackPlayer.play(), 200);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Remote pause error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Remote stop error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    try {
      // We don't handle the actual next song logic here anymore
      // Instead, we'll emit an event that the MusicContext will listen for
      // and handle using its local playlist state
      console.log('Service: Remote next - signaling to use local playlist');

      // Simplified approach - no direct queue manipulation
      // The RemoteNext event is already handled in MusicContext.tsx
      // through the Event.RemoteNext listener
    } catch (error) {
      console.error('Error handling remote next track:', error);
    }
  });

  // Simplified previous track handler that defers to MusicContext
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      // We don't handle the actual previous song logic here anymore
      // Instead, we'll rely on the MusicContext to handle this
      // through its Event.RemotePrevious listener
      console.log('Service: Remote previous - signaling to use local playlist');
    } catch (error) {
      console.error('Error handling remote previous track:', error);
    }
  });

  // Handle seeking from lock screen / notifications with better error handling
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    try {
      await TrackPlayer.seekTo(event.position);
    } catch (error) {
      console.error('Remote seek error:', error);
      // Retry seek with a slight delay
      setTimeout(() => TrackPlayer.seekTo(event.position), 150);
    }
  });

  // Handle jump forward/backward with improved response time
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    try {
      // Get position more efficiently
      const position = (await TrackPlayer.getProgress()).position;
      // Use faster direct seek
      await TrackPlayer.seekTo(position + (event.interval || 10));
    } catch (error) {
      console.error('Remote jump forward error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    try {
      // Get position more efficiently
      const position = (await TrackPlayer.getProgress()).position;
      // Use faster direct seek with bounds checking
      await TrackPlayer.seekTo(Math.max(0, position - (event.interval || 10)));
    } catch (error) {
      console.error('Remote jump backward error:', error);
    }
  });

  // Update to use PlaybackActiveTrackChanged instead of deprecated PlaybackTrackChanged
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
    // This helps track internal track changes by TrackPlayer
    if (event.track) {
      console.log(`Service: Track changed to ${event.track.title} by ${event.track.artist}`);
    }
  });

  // Optimize response to audio focus changes
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    try {
      if (event.paused) {
        if (event.permanent) {
          // Permanent duck - stop playback completely
          await TrackPlayer.stop();
        } else {
          // Temporary duck - just pause
          await TrackPlayer.pause();
        }
      } else {
        // Ducking ended, we can resume if we were playing before
        const state = (await getPlaybackState()).state;
        if (state === State.Paused) {
          await TrackPlayer.play();
        }
      }
    } catch (error) {
      console.error('Error handling audio focus change:', error);
    }
  });
}
