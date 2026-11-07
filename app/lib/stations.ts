import type { Album, Playlist } from '@/types/music';
import type { Song } from '@/types/song';
import { toBrowseSections } from './browseSections';

export type StationSource = { kind: 'playlist' | 'album'; id: string };

/** A vibe on the dial. Its songs are either here already or come from one playlist or album. */
export type Station = { key: string; title: string; songs?: Song[]; source?: StationSource };

/** With this many songs of its own, a section is a station without fetching anything. */
const MIN_OWN_SONGS = 4;
const MAX_SONGS = 20;

export const uniqueSongs = (songs: Song[]) => {
  const seen = new Set<string>();
  return songs
    .filter((song) => {
      if (!song?.id || seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    })
    .slice(0, MAX_SONGS);
};

/** `Tu Mil Jaaye (From "KING")` reads as `Tu Mil Jaaye` where space is short. */
export const shortSongName = (name?: string) =>
  (name ?? '').replace(/\s*\(From\s[^)]*\)\s*$/i, '') || (name ?? '');

/**
 * The dial's stations: your own mix first, then whatever the API offers right now, with its own
 * titles and order. Sections change by language and over time, so none is named here.
 */
export const buildStations = (modules: unknown, forYou: Song[]): Station[] => {
  const stations: Station[] = [];
  const mine = uniqueSongs(forYou);
  if (mine.length) stations.push({ key: 'for-you', title: 'For you', songs: mine });

  for (const section of toBrowseSections(modules)) {
    const songs = uniqueSongs(
      section.items.flatMap((item) => (item.kind === 'song' ? [item.song] : []))
    );
    if (songs.length >= MIN_OWN_SONGS) {
      stations.push({ key: section.key, title: section.title, songs });
      continue;
    }
    // A playlist before an album: an album in these sections is often a one-song single.
    const list =
      section.items.find((item) => item.kind === 'playlist') ??
      section.items.find((item) => item.kind === 'album');
    if (list?.kind === 'playlist') {
      const { id } = list.playlist as Playlist;
      stations.push({
        key: section.key,
        title: section.title,
        source: { kind: 'playlist', id: String(id) },
      });
    } else if (list?.kind === 'album') {
      const album = list.album as Album;
      stations.push({
        key: section.key,
        title: section.title,
        source: { kind: 'album', id: String(album.album_id || album.id) },
      });
    }
  }
  return stations;
};
