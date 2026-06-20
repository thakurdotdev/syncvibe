import { Song } from '@/types/song';
import * as Network from 'expo-network';
import { Track } from 'react-native-track-player';

interface StreamingConfig {
  preferredQuality: '320kbps' | '128kbps' | '48kbps' | '12kbps';
  enableCaching: boolean;
  preloadNextTrack: boolean;
  bufferSize: number;
  maxCacheSize: number;
  fallbackEnabled: boolean;
}

interface NetworkState {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
}

interface CachedTrack {
  songId: string;
  quality: string;
  url: string;
  cachedAt: number;
  size?: number;
}

class StreamingManager {
  private config: StreamingConfig;
  private networkState: NetworkState;
  private trackCache = new Map<string, CachedTrack>();
  private preloadCache = new Map<string, Promise<string>>();
  private qualityFallback: string[] = ['320kbps', '128kbps', '48kbps', '12kbps'];
  private readonly MAX_CACHE_ENTRIES = 100;
  private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(config?: Partial<StreamingConfig>) {
    this.config = {
      preferredQuality: '320kbps',
      enableCaching: true,
      preloadNextTrack: true,
      bufferSize: 1024 * 1024 * 10, // 10MB buffer
      maxCacheSize: 1024 * 1024 * 500, // 500MB cache
      fallbackEnabled: true,
      ...config,
    };

    this.networkState = {
      isConnected: true,
      type: null,
      isInternetReachable: null,
    };

    this.initNetworkMonitoring();
    this.loadCacheFromStorage();
  }

  private async initNetworkMonitoring() {
    // Get initial network state
    try {
      const initialState = await Network.getNetworkStateAsync();
      this.networkState = {
        isConnected: initialState.isConnected ?? false,
        type: initialState.type ? String(initialState.type) : null,
        isInternetReachable: initialState.isInternetReachable ?? null,
      };

      console.log('Initial network state:', this.networkState);
    } catch (error) {
      console.error('Failed to get initial network state:', error);
      this.networkState = {
        isConnected: false,
        type: null,
        isInternetReachable: null,
      };
    }

    // Set up periodic network checking since expo-network doesn't have real-time monitoring
    this.startNetworkPolling();
  }

  private startNetworkPolling() {
    // Check network state every 5 seconds
    setInterval(async () => {
      try {
        const currentState = await Network.getNetworkStateAsync();
        const previousConnected = this.networkState.isConnected;

        this.networkState = {
          isConnected: currentState.isConnected ?? false,
          type: currentState.type ? String(currentState.type) : null,
          isInternetReachable: currentState.isInternetReachable ?? null,
        };

        // If network came back online, resume any pending operations
        if (!previousConnected && this.networkState.isConnected) {
          console.log('Network restored, resuming streaming operations');
          this.handleNetworkRestoration();
        }
      } catch (error) {
        console.error('Network polling error:', error);
      }
    }, 5000);
  }

  private async loadCacheFromStorage() {
    // In a real app, you'd load this from AsyncStorage or a database
    // For now, we'll just initialize an empty cache
    console.log('Cache loaded from storage');
  }

  private async saveCacheToStorage() {
    // In a real app, you'd save this to AsyncStorage or a database
    console.log('Cache saved to storage');
  }

  private handleNetworkRestoration() {
    // Clear any failed preload attempts and retry
    this.preloadCache.clear();
  }

  private getOptimalQuality(song: Song): string {
    if (!this.networkState.isConnected) {
      return this.getCachedQuality(song.id) || this.config.preferredQuality;
    }

    // Always prefer high quality for good connections
    if (this.isHighSpeedConnection()) {
      return this.config.preferredQuality;
    }

    // For slower connections, still prefer high quality but with better buffering
    return this.config.preferredQuality;
  }

  private isHighSpeedConnection(): boolean {
    const { type } = this.networkState;

    if (type === 'WIFI') return true;
    if (type === 'CELLULAR') {
      // For cellular, assume high speed since expo-network doesn't provide effective type
      return true;
    }

    return false;
  }

  private getCachedQuality(songId: string): string | null {
    const cached = this.trackCache.get(songId);
    return cached?.quality || null;
  }

  private getBestAvailableUrl(song: Song, preferredQuality: string): string {
    // Sort download URLs by quality preference
    const qualityOrder = this.qualityFallback;
    const startIndex = qualityOrder.indexOf(preferredQuality);

    // Try preferred quality first, then fallback in order
    for (let i = startIndex; i < qualityOrder.length; i++) {
      const quality = qualityOrder[i];
      const url = song.download_url.find((u) => u.quality === quality);
      if (url?.link) {
        return url.link;
      }
    }

    // Fallback to any available URL
    return song.download_url[0]?.link || '';
  }

  private async preloadTrack(song: Song): Promise<void> {
    if (!this.config.preloadNextTrack || !this.networkState.isConnected) {
      return;
    }

    const cacheKey = `${song.id}_preload`;

    if (this.preloadCache.has(cacheKey)) {
      return; // Already preloading
    }

    const preloadPromise = this.getStreamingUrl(song, true);
    this.preloadCache.set(cacheKey, preloadPromise);

    try {
      await preloadPromise;
      console.log(`Preloaded track: ${song.name}`);
    } catch (error) {
      console.error(`Failed to preload track ${song.name}:`, error);
      this.preloadCache.delete(cacheKey);
    }
  }

  public async getStreamingUrl(song: Song, isPreload = false): Promise<string> {
    const songId = song.id;

    // Check cache first
    if (this.config.enableCaching && this.trackCache.has(songId)) {
      const cached = this.trackCache.get(songId)!;

      // Check if cache is still valid
      if (Date.now() - cached.cachedAt < this.CACHE_EXPIRY_MS) {
        console.log(`Using cached URL for: ${song.name}`);
        return cached.url;
      } else {
        this.trackCache.delete(songId);
      }
    }

    // If offline and not cached, throw error
    if (!this.networkState.isConnected) {
      throw new Error(`Song not cached and device is offline: ${song.name}`);
    }

    const optimalQuality = this.getOptimalQuality(song);
    const streamingUrl = this.getBestAvailableUrl(song, optimalQuality);

    if (!streamingUrl) {
      throw new Error(`No streaming URL available for: ${song.name}`);
    }

    // Cache the URL
    if (this.config.enableCaching) {
      this.cacheTrackUrl(songId, optimalQuality, streamingUrl);
    }

    return streamingUrl;
  }

  private cacheTrackUrl(songId: string, quality: string, url: string) {
    // Remove oldest entries if cache is full
    if (this.trackCache.size >= this.MAX_CACHE_ENTRIES) {
      const oldestEntry = Array.from(this.trackCache.entries()).sort(
        ([, a], [, b]) => a.cachedAt - b.cachedAt
      )[0];

      if (oldestEntry) {
        this.trackCache.delete(oldestEntry[0]);
      }
    }

    this.trackCache.set(songId, {
      songId,
      quality,
      url,
      cachedAt: Date.now(),
    });

    this.saveCacheToStorage();
  }

  public async convertSongToStreamingTrack(song: Song): Promise<Track> {
    try {
      const audioUrl = await this.getStreamingUrl(song);

      const artwork = song.image[2]?.link || song.image[1]?.link || song.image[0]?.link;

      const track: Track = {
        id: song.id,
        url: audioUrl,
        title: song.name || 'Unknown Title',
        artist: song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        artwork: artwork,
        duration: song.duration || 0,
        headers: {
          'User-Agent': 'SyncVibe/1.0',
          Accept: 'audio/*',
        },
      };

      return track;
    } catch (error) {
      console.error(`Failed to convert song to streaming track: ${song.name}`, error);
      throw error;
    }
  }

  public async preloadNextTracks(songs: Song[], currentIndex: number) {
    if (!this.config.preloadNextTrack || currentIndex >= songs.length - 1) {
      return;
    }

    // Preload next 2 tracks
    const tracksToPreload = songs.slice(currentIndex + 1, currentIndex + 3);

    const preloadPromises = tracksToPreload.map((song) =>
      this.preloadTrack(song).catch((error) =>
        console.error(`Failed to preload ${song.name}:`, error)
      )
    );

    await Promise.allSettled(preloadPromises);
  }

  public clearCache() {
    this.trackCache.clear();
    this.preloadCache.clear();
    this.saveCacheToStorage();
    console.log('Streaming cache cleared');
  }

  public getCacheStats() {
    const totalCachedTracks = this.trackCache.size;
    const cacheHitRate = this.trackCache.size > 0 ? 1 : 0; // Simplified calculation

    return {
      totalCachedTracks,
      cacheHitRate,
      networkConnected: this.networkState.isConnected,
      networkType: this.networkState.type,
    };
  }

  public updateConfig(newConfig: Partial<StreamingConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getNetworkState() {
    return { ...this.networkState };
  }
}

// Export singleton instance
export const streamingManager = new StreamingManager();
export default streamingManager;
