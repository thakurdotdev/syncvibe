import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import type { AudioStatus } from 'expo-audio/build/Audio.types';

const SFX_AUTOPLAY_KEY = '@syncvibe_sfx_autoplay';
const SFX_VOLUME = 0.8;

interface EventSubscription {
  remove(): void;
}

type AudioPlayerWithEvents = AudioPlayer & {
  addListener(
    eventName: 'playbackStatusUpdate' | 'audioSampleUpdate' | string,
    listener: (status: AudioStatus) => void
  ): EventSubscription;
};

class SoundEffectsManager {
  private isAutoPlayEnabled: boolean = true;
  private previewPlayer: AudioPlayerWithEvents | null = null;
  private previewUrl: string | null = null;
  private currentOnEnd: (() => void) | null = null;

  constructor() {
    this.loadAutoPlaySetting();
  }

  private async loadAutoPlaySetting() {
    try {
      const stored = await AsyncStorage.getItem(SFX_AUTOPLAY_KEY);
      if (stored !== null) {
        this.isAutoPlayEnabled = stored !== 'false';
      }
    } catch (e) {
      console.warn('Failed to load SFX autoplay setting:', e);
    }
  }

  public getAutoPlay(): boolean {
    return this.isAutoPlayEnabled;
  }

  public async setAutoPlay(enabled: boolean): Promise<void> {
    this.isAutoPlayEnabled = enabled;
    try {
      await AsyncStorage.setItem(SFX_AUTOPLAY_KEY, String(enabled));
    } catch (e) {
      console.warn('Failed to save SFX autoplay setting:', e);
    }
  }

  /**
   * Play a preview sound clip (in sound picker or sound message)
   */
  public playPreview(url: string, onEnd?: () => void, onError?: (err: any) => void): void {
    this.stopPreview();

    if (!url) return;

    this.previewUrl = url;
    this.currentOnEnd = onEnd || null;

    try {
      const player = createAudioPlayer({ uri: url }) as AudioPlayerWithEvents;
      player.volume = SFX_VOLUME;
      this.previewPlayer = player;

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          this.stopPreview();
        }
      });

      player.play();
    } catch (err) {
      console.error('Sound preview playback error:', err);
      this.stopPreview();
      onError?.(err);
    }
  }

  /**
   * Stop active preview playback and cleanup resources
   */
  public stopPreview(): void {
    if (this.previewPlayer) {
      try {
        this.previewPlayer.pause();
        this.previewPlayer.remove();
      } catch (err) {
        console.warn('Error stopping sound preview:', err);
      }
      this.previewPlayer = null;
    }

    this.previewUrl = null;

    if (this.currentOnEnd) {
      const cb = this.currentOnEnd;
      this.currentOnEnd = null;
      cb();
    }
  }

  /**
   * Check if specific URL is currently playing as preview
   */
  public isPlayingPreview(url: string): boolean {
    return this.previewUrl === url;
  }

  /**
   * Play live room sound effect triggered by group members
   */
  public playRoomEffect(url: string): void {
    if (!url || !this.isAutoPlayEnabled) return;

    try {
      const player = createAudioPlayer({ uri: url }) as AudioPlayerWithEvents;
      player.volume = SFX_VOLUME;

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          try {
            player.remove();
          } catch {}
        }
      });

      player.play();
    } catch (err) {
      console.error('Room sound effect playback error:', err);
    }
  }
}

export const soundEffectsManager = new SoundEffectsManager();
