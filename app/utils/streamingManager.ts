import { Song } from '@/types/song';
import * as Network from 'expo-network';

interface StreamingConfig {
  preferredQuality: '320kbps' | '128kbps' | '48kbps' | '12kbps';
  enableCaching: boolean;
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
}

interface MediaItemData {
  mediaId: string;
  url: any;
  title: string;
  artist: string;
  albumTitle: string;
  artworkUrl: string;
  duration: number;
}

class StreamingManager {
  private config: StreamingConfig;
  private networkState: NetworkState;
  private trackCache = new Map<string, CachedTrack>();
  private qualityFallback: string[] = ['320kbps', '128kbps', '48kbps', '12kbps'];
  private readonly MAX_CACHE_ENTRIES = 100;
  private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

  constructor(config?: Partial<StreamingConfig>) {
    this.config = {
      preferredQuality: '320kbps',
      enableCaching: true,
      ...config,
    };

    this.networkState = {
      isConnected: true,
      type: null,
      isInternetReachable: null,
    };

    this.initNetworkState();
  }

  private async initNetworkState() {
    try {
      const initialState = await Network.getNetworkStateAsync();
      this.networkState = {
        isConnected: initialState.isConnected ?? false,
        type: initialState.type ? String(initialState.type) : null,
        isInternetReachable: initialState.isInternetReachable ?? null,
      };
    } catch (error) {
      console.error('Failed to get initial network state:', error);
      this.networkState = {
        isConnected: false,
        type: null,
        isInternetReachable: null,
      };
    }
  }

  private getOptimalQuality(song: Song): string {
    if (!this.networkState.isConnected) {
      return this.getCachedQuality(song.id) || this.config.preferredQuality;
    }
    return this.config.preferredQuality;
  }

  private getCachedQuality(songId: string): string | null {
    const cached = this.trackCache.get(songId);
    return cached?.quality || null;
  }

  private getBestAvailableUrl(song: Song, preferredQuality: string): string {
    const qualityOrder = this.qualityFallback;
    const startIndex = qualityOrder.indexOf(preferredQuality);

    for (let i = startIndex; i < qualityOrder.length; i++) {
      const quality = qualityOrder[i];
      const url = song.download_url.find((u) => u.quality === quality);
      if (url?.link) {
        return url.link;
      }
    }

    return song.download_url[0]?.link || '';
  }

  public async getStreamingUrl(song: Song): Promise<string> {
    const songId = song.id;

    if (this.config.enableCaching && this.trackCache.has(songId)) {
      const cached = this.trackCache.get(songId)!;

      if (Date.now() - cached.cachedAt < this.CACHE_EXPIRY_MS) {
        return cached.url;
      }
      this.trackCache.delete(songId);
    }

    if (!this.networkState.isConnected) {
      throw new Error(`Song not cached and device is offline: ${song.name}`);
    }

    const optimalQuality = this.getOptimalQuality(song);
    const streamingUrl = this.getBestAvailableUrl(song, optimalQuality);

    if (!streamingUrl) {
      throw new Error(`No streaming URL available for: ${song.name}`);
    }

    if (this.config.enableCaching) {
      this.cacheTrackUrl(songId, optimalQuality, streamingUrl);
    }

    return streamingUrl;
  }

  private cacheTrackUrl(songId: string, quality: string, url: string) {
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
  }

  public async convertSongToStreamingTrack(song: Song): Promise<MediaItemData> {
    const audioUrl = await this.getStreamingUrl(song);
    const artwork = song.image[2]?.link || song.image[1]?.link || song.image[0]?.link;

    return {
      mediaId: song.id,
      url: {
        uri: audioUrl,
        headers: {
          'User-Agent': 'SyncVibe/1.0',
          Accept: 'audio/*',
        },
      },
      title: song.name || 'Unknown Title',
      artist: song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
      albumTitle: song.album || 'Unknown Album',
      artworkUrl: artwork,
      duration: song.duration || 0,
    };
  }

  public clearCache() {
    this.trackCache.clear();
  }

  public getCacheStats() {
    return {
      totalCachedTracks: this.trackCache.size,
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

  public async refreshNetworkState() {
    await this.initNetworkState();
    return this.getNetworkState();
  }
}

export const streamingManager = new StreamingManager();
export default streamingManager;
