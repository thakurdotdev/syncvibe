const IMAGE_SIZE_INDEX = { small: 0, medium: 1, large: 2 };

export const getArtistName = (song, fallback = 'Unknown Artist') =>
  song?.artist_map?.primary_artists?.[0]?.name || fallback;

/**
 * Returns the best available artwork URL for a song, preferring the requested size
 * and falling back to smaller variants.
 */
export const getSongImage = (song, size = 'large') => {
  const images = song?.image;
  if (!images?.length) return '';
  for (let i = IMAGE_SIZE_INDEX[size] ?? 2; i >= 0; i -= 1) {
    if (images[i]?.link) return images[i].link;
  }
  return images[0]?.link || '';
};

export const getInitial = (name) => name?.charAt(0)?.toUpperCase() || '?';
