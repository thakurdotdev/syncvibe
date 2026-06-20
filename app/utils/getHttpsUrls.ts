import { Song, Artist, ImageQuality, DownloadQuality } from '@/types/song';

/**
 * Converts any HTTP URL to HTTPS URL
 */
export const convertToHttps = (url: string): string => {
  if (!url) return url;
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
};

/**
 * Ensures all ImageQuality links use HTTPS
 */
const ensureHttpsForImages = (
  images?: ImageQuality[] | ImageQuality | string
): ImageQuality[] => {
  if (!images) return [];

  if (typeof images === 'string') {
    const link = convertToHttps(images);
    return [
      { quality: '50x50', link },
      { quality: '150x150', link },
      { quality: '500x500', link },
    ];
  }

  if (!Array.isArray(images)) {
    const link = images.link
      ? convertToHttps(images.link)
      : 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp';
    return [
      { quality: '50x50', link },
      { quality: '150x150', link },
      { quality: '500x500', link },
    ];
  }

  const mapped = images.map((img) => ({
    quality: img.quality || 'default',
    link: img.link
      ? convertToHttps(img.link)
      : 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp',
  }));

  while (mapped.length < 3) {
    mapped.push({
      quality: 'default',
      link: mapped[mapped.length - 1]?.link || 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp',
    });
  }

  return mapped;
};

/**
 * Ensures all artists' URLs and image links use HTTPS
 */
const ensureHttpsForArtists = (artists?: Artist[]): Artist[] => {
  if (!artists) return [];
  return artists.map((artist) => ({
    ...artist,
    url: artist.url ? convertToHttps(artist.url) : undefined,
    image: artist.image
      ? ensureHttpsForImages(artist.image)
      : 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp',
  }));
};

/**
 * Ensures all DownloadQuality links use HTTPS
 */
const ensureHttpsForDownloadUrls = (downloadUrls?: DownloadQuality[]): DownloadQuality[] => {
  if (!downloadUrls) return [];
  return downloadUrls.map((item) => ({
    ...item,
    link: item.link ? convertToHttps(item.link) : undefined,
  }));
};

/**
 * Ensures all URLs in a song object use HTTPS instead of HTTP
 */
export const ensureHttpsForSongUrls = (song: Song): Song => {
  if (!song) return song;

  const securedSong = { ...song };

  if (song.url) securedSong.url = convertToHttps(song.url);
  if (song.image) securedSong.image = ensureHttpsForImages(song.image);

  // Handle artist_map if it exists
  if (song.artist_map) {
    securedSong.artist_map = { ...song.artist_map };
    if (song.artist_map.artists) {
      securedSong.artist_map.artists = ensureHttpsForArtists(song.artist_map.artists);
    }
    if (song.artist_map.featured_artists) {
      securedSong.artist_map.featured_artists = ensureHttpsForArtists(
        song.artist_map.featured_artists
      );
    }
    if (song.artist_map.primary_artists) {
      securedSong.artist_map.primary_artists = ensureHttpsForArtists(
        song.artist_map.primary_artists
      );
    }
  }

  if (song.album_url) securedSong.album_url = convertToHttps(song.album_url);
  if (song.label_url) securedSong.label_url = convertToHttps(song.label_url);
  if (song.download_url) securedSong.download_url = ensureHttpsForDownloadUrls(song.download_url);

  return securedSong;
};

/**
 * Ensures all URLs in an album object use HTTPS
 */
export const ensureHttpsForAlbumUrls = (album: any): any => {
  if (!album) return album;

  const securedAlbum = { ...album };

  if (album.url) securedAlbum.url = convertToHttps(album.url);
  if (album.image) securedAlbum.image = ensureHttpsForImages(album.image);
  if (album.artists) securedAlbum.artists = ensureHttpsForArtists(album.artists);

  if (album.artist) {
    securedAlbum.artist = { ...album.artist };
    if (album.artist.url) securedAlbum.artist.url = convertToHttps(album.artist.url);
    if (album.artist.image) securedAlbum.artist.image = ensureHttpsForImages(album.artist.image);
  }

  return securedAlbum;
};

/**
 * Ensures all URLs in an artist object use HTTPS
 */
export const ensureHttpsForArtistUrls = (artist: any): any => {
  if (!artist) return artist;

  const securedArtist = { ...artist };

  if (artist.url) securedArtist.url = convertToHttps(artist.url);
  if (artist.image) {
    securedArtist.image = ensureHttpsForImages(artist.image);
  } else {
    securedArtist.image =
      'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp';
  }

  if (Array.isArray(artist.albums)) {
    securedArtist.albums = artist.albums.map((album: any) => ensureHttpsForAlbumUrls(album));
  }

  if (Array.isArray(artist.similar_artists)) {
    securedArtist.similar_artists = artist.similar_artists.map((similarArtist: any) =>
      ensureHttpsForArtistUrls(similarArtist)
    );
  }

  return securedArtist;
};

/**
 * Ensures all URLs in a playlist object use HTTPS
 */
export const ensureHttpsForPlaylistUrls = (playlist: any): any => {
  if (!playlist) return playlist;

  const securedPlaylist = { ...playlist };

  if (playlist.url) securedPlaylist.url = convertToHttps(playlist.url);

  if (playlist.image) {
    securedPlaylist.image = Array.isArray(playlist.image)
      ? ensureHttpsForImages(playlist.image)
      : playlist.image
        ? convertToHttps(playlist.image)
        : 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp';
  }

  if (playlist.artists) {
    securedPlaylist.artists = Array.isArray(playlist.artists)
      ? ensureHttpsForArtists(playlist.artists)
      : playlist.artists;
  }

  return securedPlaylist;
};
