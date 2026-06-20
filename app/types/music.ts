import { Song } from './song';

export type Type =
  | 'artist'
  | 'album'
  | 'playlist'
  | 'radio'
  | 'radio_station'
  | 'song'
  | 'channel'
  | 'mix'
  | 'show'
  | 'episode'
  | 'season'
  | 'label';

export interface Album {
  album_id?: string;
  id: string;
  name: string;
  subtitle?: string;
  type: Type;
  url: string;
  image: Array<{ quality: string; link: string }>;
  language: string;
  year: number;
  header_desc: string;
  play_count: number;
  explicit: boolean;
  list_count: number;
  artist_map: {
    artists: Array<{
      id: string;
      name: string;
      url: string;
      role: string;
      type: string;
      image: Array<{ quality: string; link: string }>;
    }>;
    featured_artists: Array<{
      id: string;
      name: string;
      url: string;
      role: string;
      type: string;
      image: Array<{ quality: string; link: string }>;
    }>;
    primary_artists: Array<{
      id: string;
      name: string;
      url: string;
      role: string;
      type: string;
      image: Array<{ quality: string; link: string }>;
    }>;
  };
}

export interface Playlist {
  id: string;
  name: string;
  subtitle?: string;
  type: Type;
  url: string;
  image: Array<{ quality: string; link: string }>;
  language: string;
  year: number;
  header_desc: string;
  play_count: number;
  explicit: boolean;
  list_count: number;
}

export interface Chart {
  id: string;
  name: string;
  subtitle?: string;
  type: Type;
  url: string;
  image: Array<{ quality: string; link: string }>;
  language: string;
  year: number;
  header_desc: string;
  play_count: number;
  explicit: boolean;
  list_count: number;
}

export interface Artist {
  id: string;
  name: string;
  url: string;
  role: string;
  type: string;
  image: Array<{ quality: string; link: string }>;
}

export interface HomePageResponse {
  trending: {
    data: Song[];
  };
  playlists: {
    data: Playlist[];
  };
  albums: {
    data: Album[];
  };
  charts: {
    data: Chart[];
  };
  artist_recos: {
    data: Artist[];
  };
}

export interface RecentMusicResponse {
  songs: Song[];
  recentlyPlayed: Song[];
}

export interface PlaylistDetails {
  id: string;
  name: string;
  header_desc: string;
  list_count: number;
  follower_count: number;
  image: string;
  songs: Song[];
}

export interface AlbumDetails {
  id: string;
  name: string;
  header_desc: string;
  subtitle: string;
  year: number;
  duration: number;
  image: Array<{ quality: string; link: string }>;
  artistmap: Array<{
    id: string;
    name: string;
    url: string;
    role: string;
    type: string;
    image: Array<{ quality: string; link: string }>;
  }>;
  songs: Song[];
}

export interface ArtistDetails {
  id: string;
  name: string;
  header_desc: string;
  list_count: number;
  follower_count: number;
  image: Array<{ quality: string; link: string }>;
  top_songs: Array<Song>;
  top_albums: Array<Album>;
  dedicated_artist_playlist: Array<Playlist>;
  similar_artists: Array<Artist>;
}

export interface MusicHistoryParams {
  page: number;
  limit: number;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface MusicHistoryResponse {
  songs: Song[];
  count: number;
}

export interface TimeState {
  currentTime: number;
  duration: number;
}

export interface PlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
}

export interface PlaylistState {
  playlist: Song[];
  userPlaylist: any[];
}

export interface SleepTimerState {
  timeRemaining: number;
  songsRemaining: number;
  isActive: boolean;
}

export interface TimeContextValue extends TimeState {
  updateTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

export interface PlaybackContextValue extends PlaybackState {
  setCurrentSong: (song: Song) => void;
  setPlaying: (isPlaying: boolean) => void;
  setLoading: (loading: boolean) => void;
  stopSong: () => void;
}

export interface PlayerControls {
  playSong: (song: Song) => void;
  stopSong: () => void;
  handlePlayPauseSong: () => void;
  addToPlaylist: (songs: Song | Song[]) => void;
  addToQueue: (songs: Song | Song[]) => void;
  handleNextSong: () => void;
  handlePrevSong: () => void;
  clearQueue: () => void;
  removeFromQueue: (songId: string) => void;
  reorderPlaylist: (newPlaylistOrder: Song[]) => void;
}

export interface PlaylistContextValue extends PlaylistState {
  getPlaylists: () => Promise<void>;
  setPlaylist: (playlist: Song[]) => void;
  setUserPlaylist: (playlist: Song[]) => void;
}

export interface SleepTimerContextValue extends SleepTimerState {
  setSleepTimer: (minutes?: number, songs?: number) => void;
  clearSleepTimer: () => void;
}
