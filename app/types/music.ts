import { Song, ImageQuality } from "./song"

export type Type =
  | "artist"
  | "album"
  | "playlist"
  | "radio"
  | "radio_station"
  | "song"
  | "channel"
  | "mix"
  | "show"
  | "episode"
  | "season"
  | "label"

export interface AlbumArtist {
  id?: string
  name: string
  url?: string
  role?: string
  type?: string
  image?: ImageQuality[] | string
}

export interface AlbumArtistMap {
  artists?: AlbumArtist[]
  featured_artists?: AlbumArtist[]
  primary_artists?: AlbumArtist[]
}

export interface Album {
  album_id?: string
  id: string
  name: string
  title?: string
  subtitle?: string
  type?: Type | string
  url?: string
  image?: ImageQuality[] | string
  language?: string
  year?: number | string
  header_desc?: string
  play_count?: number
  explicit?: boolean
  list_count?: number
  artist?: string | AlbumArtist
  artists?: AlbumArtist[]
  artist_map?: AlbumArtistMap
  songs?: Song[]
}

export interface Playlist {
  id: string
  name: string
  title?: string
  subtitle?: string
  description?: string
  type?: Type | string
  url?: string
  image?: ImageQuality[] | string
  language?: string
  year?: number | string
  header_desc?: string
  play_count?: number
  explicit?: boolean
  list_count?: number
  songCount?: number
  artists?: AlbumArtist[]
  songs?: Song[]
}

export interface Chart {
  id: string
  name: string
  subtitle?: string
  type?: Type | string
  url?: string
  image?: ImageQuality[] | string
  language?: string
  year?: number | string
  header_desc?: string
  play_count?: number
  explicit?: boolean
  list_count?: number
}

export interface Artist {
  id: string
  name: string
  url?: string
  role?: string
  type?: string
  image?: ImageQuality[] | string
  description?: string
  header_desc?: string
  follower_count?: number | string
  list_count?: number | string
}

export interface ArtistBio {
  text?: string
  title?: string
  sequence?: { key: string; value: string }[]
}

export interface ArtistDetails {
  id: string
  name: string
  header_desc?: string
  list_count?: number | string
  follower_count?: number | string
  fan_count?: number | string
  is_verified?: boolean
  dominant_type?: string
  dominant_language?: string
  image?: ImageQuality[] | string
  bio?: ArtistBio[]
  dob?: string
  fb?: string
  twitter?: string
  wiki?: string
  available_languages?: string[]
  is_radio_present?: boolean
  top_songs: Song[]
  top_albums: Album[]
  dedicated_artist_playlist: Playlist[]
  featured_artist_playlist?: Playlist[]
  similar_artists: Artist[]
  singles?: Song[]
  latest_release?: Album[]
}

export interface UserPlaylist {
  id: string
  name: string
  image?: ImageQuality[] | string
  songCount?: number
  songs?: Song[]
}

export interface HomePageResponse {
  trending: {
    data: Song[]
  }
  playlists: {
    data: Playlist[]
  }
  albums: {
    data: Album[]
  }
  charts: {
    data: Chart[]
  }
  artist_recos: {
    data: Artist[]
  }
}

export interface RecentMusicResponse {
  songs: Song[]
  recentlyPlayed: Song[]
}

export interface PlaylistDetails {
  id: string
  name: string
  header_desc?: string
  list_count?: number
  follower_count?: number
  image?: ImageQuality[] | string
  songs: Song[]
}

export interface AlbumDetails {
  id: string
  name: string
  header_desc?: string
  subtitle?: string
  year?: number | string
  duration?: number
  image?: ImageQuality[] | string
  artistmap?: AlbumArtist[]
  songs: Song[]
}

export interface MusicHistoryParams {
  page: number
  limit: number
  searchQuery?: string
  sortBy?: string
  sortOrder?: "ASC" | "DESC"
}

export interface MusicHistoryResponse {
  songs: Song[]
  count: number
}

export interface TimeState {
  currentTime: number
  duration: number
}

export interface PlaybackState {
  currentSong: Song | null
  isPlaying: boolean
  isLoading: boolean
}

export interface PlaylistState {
  playlist: Song[]
  userPlaylist: UserPlaylist[]
}

export interface SleepTimerState {
  timeRemaining: number
  songsRemaining: number
  isActive: boolean
}

export interface TimeContextValue extends TimeState {
  updateTime: (time: number) => void
  setDuration: (duration: number) => void
}

export interface PlaybackContextValue extends PlaybackState {
  setCurrentSong: (song: Song) => void
  setPlaying: (isPlaying: boolean) => void
  setLoading: (loading: boolean) => void
  stopSong: () => void
}

export interface PlayerControls {
  playSong: (song: Song) => void
  stopSong: () => void
  handlePlayPauseSong: () => void
  addToPlaylist: (songs: Song | Song[]) => void
  addToQueue: (songs: Song | Song[]) => void
  handleNextSong: () => void
  handlePrevSong: () => void
  clearQueue: () => void
  removeFromQueue: (songId: string) => void
  reorderPlaylist: (newPlaylistOrder: Song[]) => void
}

export interface PlaylistContextValue extends PlaylistState {
  getPlaylists: () => Promise<void>
  setPlaylist: (playlist: Song[]) => void
  setUserPlaylist: (playlist: UserPlaylist[]) => void
}

export interface SleepTimerContextValue extends SleepTimerState {
  setSleepTimer: (minutes?: number, songs?: number) => void
  clearSleepTimer: () => void
}
