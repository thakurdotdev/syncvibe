export interface ImageQuality {
  quality: string;
  link: string;
}

export interface Artist {
  id: string;
  name: string;
  url: string;
  role: string;
  type: string;
  image: ImageQuality[] | ImageQuality;
}

export interface ArtistMap {
  artists: Artist[];
  featured_artists: Artist[];
  primary_artists: Artist[];
}

export interface DownloadQuality {
  quality: string;
  link: string;
}

export interface Rights {
  code: string;
  cacheable: string;
  delete_cached_object: string;
  reason: string;
}

export interface Song {
  id: string;
  name: string;
  title?: string;
  subtitle: string;
  type: string;
  url: string;
  image: ImageQuality[];
  artwork?: string;
  language: string;
  year: number;
  header_desc: string;
  play_count: number;
  explicit: boolean;
  list: string;
  list_type: string;
  list_count: number;
  music: string;
  artist_map: ArtistMap;
  artist?: string;
  album: string;
  album_id: string;
  album_url: string;
  label: string;
  label_url: string;
  origin: string;
  is_dolby_content: boolean;
  '320kbps': boolean;
  download_url: DownloadQuality[];
  duration: number;
  rights: Rights;
  has_lyrics: boolean;
  lyrics_snippet: string;
  starred: boolean;
  release_date: string;
  triller_available: boolean;
  copyright_text: string;
  isPlaying?: boolean;
}
