import { Song } from '@/types/song';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PlaybackProgress {
  songId: string;
  position: number;
  duration: number;
  timestamp: number;
  synced: boolean;
  songData: Song;
  isPlaying?: boolean; // Add isPlaying flag
}

const CURRENT_SONG_KEY = '@syncvibe/current_song';

class PlaybackHistoryManager {
  private static instance: PlaybackHistoryManager;
  private currentSong: PlaybackProgress | null = null;
  private appState: string = 'active';
  private isPlaying: boolean = false; // Track playback state

  private constructor() { }

  public static getInstance(): PlaybackHistoryManager {
    if (!PlaybackHistoryManager.instance) {
      PlaybackHistoryManager.instance = new PlaybackHistoryManager();
    }
    return PlaybackHistoryManager.instance;
  }

  private async saveToLocal(progress: PlaybackProgress): Promise<void> {
    try {
      await AsyncStorage.setItem(CURRENT_SONG_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving current song progress locally:', error);
    }
  }

  private async getLocalData(): Promise<PlaybackProgress | null> {
    try {
      const data = await AsyncStorage.getItem(CURRENT_SONG_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading current song data:', error);
      return null;
    }
  }

  public async updatePlaybackProgress(
    song: Song,
    position: number,
    duration: number,
    isPlaying: boolean = true
  ): Promise<void> {
    if (!song?.id) return;

    // Update playing state
    this.isPlaying = isPlaying;

    // If it's the same song, just update position
    if (this.currentSong && this.currentSong.songId === song.id) {
      this.currentSong.position = position;
      this.currentSong.duration = duration;
      this.currentSong.timestamp = Date.now();
      this.currentSong.isPlaying = isPlaying;
      this.currentSong.synced = false;
    } else {
      // Create new progress record for a different song
      this.currentSong = {
        songId: song.id,
        position,
        duration,
        timestamp: Date.now(),
        synced: false,
        songData: song,
        isPlaying,
      };
    }

    // Save to local storage
    await this.saveToLocal(this.currentSong);
  }

  public async getCurrentSongProgress(): Promise<PlaybackProgress | null> {
    // If we have a current song in memory, return it
    if (this.currentSong) {
      return this.currentSong;
    }

    // Otherwise try to load from storage
    const storedProgress = await this.getLocalData();
    if (storedProgress) {
      this.currentSong = storedProgress;
    }

    return storedProgress;
  }

  public async getLastPlayedSong(): Promise<{
    song: Song;
    position: number;
  } | null> {
    try {
      const progress = await this.getCurrentSongProgress();
      if (progress && progress.songData) {
        return {
          song: progress.songData,
          position: progress.position,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting last played song:', error);
      return null;
    }
  }

  public async preloadHistoryData(): Promise<void> {
    try {
      // Simply pre-load the current song data
      const progress = await this.getLocalData();
      if (progress) {
        this.currentSong = progress;
      }
    } catch (error) {
      console.error('Error preloading history data:', error);
    }
  }

  public async pausePlayback(): Promise<void> {
    this.isPlaying = false;
    if (this.currentSong) {
      this.currentSong.isPlaying = false;
      await this.saveToLocal(this.currentSong);
    }
  }

  public async resumePlayback(): Promise<void> {
    this.isPlaying = true;
    if (this.currentSong) {
      this.currentSong.isPlaying = true;
      await this.saveToLocal(this.currentSong);
    }
  }

  public async stopPlayback(): Promise<void> {
    this.isPlaying = false;
    if (this.currentSong) {
      this.currentSong.isPlaying = false;
      await this.saveToLocal(this.currentSong);
    }
  }

  public getDebugInfo(): {
    isPlaying: boolean;
    currentSong: PlaybackProgress | null;
    appState: string;
  } {
    return {
      isPlaying: this.isPlaying,
      currentSong: this.currentSong,
      appState: this.appState,
    };
  }

  public destroy(): void { }
}

export const playbackHistory = PlaybackHistoryManager.getInstance();
export default playbackHistory;
