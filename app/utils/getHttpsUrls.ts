import type { Album, Artist as MusicArtist, Playlist } from "@/types/music"
import { Song, Artist, ImageQuality, DownloadQuality } from "@/types/song"

/**
 * Converts any HTTP URL to HTTPS URL
 */
export const convertToHttps = (url: string): string => {
  if (!url) return url
  return url.startsWith("http://") ? url.replace("http://", "https://") : url
}

/**
 * Ensures all ImageQuality links use HTTPS
 */
const ensureHttpsForImages = (images?: ImageQuality[] | ImageQuality | string): ImageQuality[] => {
  if (!images) return []

  if (typeof images === "string") {
    const link = convertToHttps(images)
    return [
      { quality: "50x50", link },
      { quality: "150x150", link },
      { quality: "500x500", link },
    ]
  }

  if (!Array.isArray(images)) {
    const link = images.link
      ? convertToHttps(images.link)
      : "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
    return [
      { quality: "50x50", link },
      { quality: "150x150", link },
      { quality: "500x500", link },
    ]
  }

  const mapped = images.map((img) => ({
    quality: img.quality || "default",
    link: img.link
      ? convertToHttps(img.link)
      : "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp",
  }))

  while (mapped.length < 3) {
    mapped.push({
      quality: "default",
      link:
        mapped[mapped.length - 1]?.link ||
        "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp",
    })
  }

  return mapped
}

/**
 * Ensures all artists' URLs and image links use HTTPS
 */
const ensureHttpsForArtists = <
  T extends Artist | { name: string; url?: string; image?: ImageQuality[] | ImageQuality | string }
>(
  artists?: T[],
): T[] => {
  if (!artists) return []
  return artists.map((artist) => ({
    ...artist,
    url: artist.url ? convertToHttps(artist.url) : (artist.url as string | undefined),
    image: artist.image
      ? ensureHttpsForImages(artist.image as ImageQuality[] | ImageQuality | string)
      : "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp",
  }))
}

/**
 * Ensures all DownloadQuality links use HTTPS
 */
const ensureHttpsForDownloadUrls = (downloadUrls?: DownloadQuality[]): DownloadQuality[] => {
  if (!downloadUrls) return []
  return downloadUrls.map((item) => ({
    ...item,
    link: convertToHttps(item.link || ""),
  }))
}

/**
 * Ensures all URLs in a song object use HTTPS instead of HTTP
 */
export const ensureHttpsForSongUrls = (song: Song): Song => {
  if (!song) return song

  const securedSong = { ...song }

  if (song.url) securedSong.url = convertToHttps(song.url)
  if (song.image) securedSong.image = ensureHttpsForImages(song.image)

  if (song.artist_map) {
    securedSong.artist_map = { ...song.artist_map }
    if (song.artist_map.artists) {
      securedSong.artist_map.artists = ensureHttpsForArtists(song.artist_map.artists)
    }
    if (song.artist_map.featured_artists) {
      securedSong.artist_map.featured_artists = ensureHttpsForArtists(
        song.artist_map.featured_artists,
      )
    }
    if (song.artist_map.primary_artists) {
      securedSong.artist_map.primary_artists = ensureHttpsForArtists(
        song.artist_map.primary_artists,
      )
    }
  }

  if (song.album_url) securedSong.album_url = convertToHttps(song.album_url)
  if (song.label_url) securedSong.label_url = convertToHttps(song.label_url)
  if (song.download_url) securedSong.download_url = ensureHttpsForDownloadUrls(song.download_url)

  return securedSong
}

/**
 * Ensures all URLs in an album object use HTTPS
 */
export const ensureHttpsForAlbumUrls = (album: Album): Album => {
  if (!album) return album

  const securedAlbum = { ...album }

  if (album.url) securedAlbum.url = convertToHttps(album.url)
  if (album.image) securedAlbum.image = ensureHttpsForImages(album.image)
  if (album.artists) securedAlbum.artists = ensureHttpsForArtists(album.artists)

  if (album.artist && typeof album.artist === "object") {
    securedAlbum.artist = {
      ...album.artist,
      url: album.artist.url ? convertToHttps(album.artist.url) : undefined,
      image: album.artist.image ? ensureHttpsForImages(album.artist.image) : undefined,
    }
  }

  return securedAlbum
}

/**
 * Ensures all URLs in an artist object use HTTPS
 */
export const ensureHttpsForArtistUrls = (artist: MusicArtist): MusicArtist => {
  if (!artist) return artist

  const securedArtist = { ...artist }

  if (artist.url) securedArtist.url = convertToHttps(artist.url)
  if (artist.image) {
    securedArtist.image = ensureHttpsForImages(artist.image)
  } else {
    securedArtist.image =
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
  }

  return securedArtist
}

/**
 * Ensures all URLs in a playlist object use HTTPS
 */
export const ensureHttpsForPlaylistUrls = (playlist: Playlist): Playlist => {
  if (!playlist) return playlist

  const securedPlaylist = { ...playlist }

  if (playlist.url) securedPlaylist.url = convertToHttps(playlist.url)

  if (playlist.image) {
    securedPlaylist.image = Array.isArray(playlist.image)
      ? ensureHttpsForImages(playlist.image)
      : typeof playlist.image === "string"
        ? convertToHttps(playlist.image)
        : "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
  }

  if (playlist.artists) {
    securedPlaylist.artists = ensureHttpsForArtists(playlist.artists)
  }

  return securedPlaylist
}
