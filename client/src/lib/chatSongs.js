import he from 'he';

/** Songs shared in direct messages: how a card or a list names them. */

export const songName = (song) => he.decode(song?.name || song?.title || 'A song');

/** "Arijit Singh, Mithoon": the singers first, at most three. */
export const songArtists = (song) => {
  const map = song?.artist_map;
  const list = map?.primary_artists?.length ? map.primary_artists : (map?.artists ?? []);
  return he.decode(
    list
      .map((artist) => artist?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') ||
      song?.subtitle ||
      ''
  );
};

/** The cover at a size that suits a small square: the API lists them smallest first. */
export const songCoverOf = (song) => song?.image?.[1]?.link || song?.image?.at?.(-1)?.link;
