import type { Song } from '@/types/song';

/** Songs shared in direct messages: how a card or a notification names them. */

/** "Arijit Singh, Mithoon": the singers first, at most three. */
export const songArtists = (song: Song): string => {
  const map = song.artist_map;
  const list = map?.primary_artists?.length ? map.primary_artists : (map?.artists ?? []);
  return (
    list
      .map((artist) => artist?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') ||
    song.subtitle ||
    ''
  );
};

/** The cover at a size that suits a small square: the API lists them smallest first. */
export const songCoverOf = (song: Song): string | undefined =>
  song.image?.[1]?.link || song.image?.[song.image.length - 1]?.link;
