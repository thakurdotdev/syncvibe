/** Songs shared in a conversation: the text older app versions show, and the cover for a push. */

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  '#039': "'",
  lt: '<',
  gt: '>',
};

/** The song API's names come HTML-escaped ("Tum Hi Ho &amp; More"). */
const unescape = (text: string) =>
  text.replace(/&(amp|quot|apos|#039|lt|gt);/g, (_, name: string) => ENTITIES[name]!);

/** What app versions from before shared songs show instead of the card. */
export const songText = (song: { name: string | null; artistNames: string | null }): string => {
  const name = unescape(song.name || 'A song');
  const artists =
    song.artistNames && song.artistNames !== 'Unknown' ? unescape(song.artistNames) : '';
  return `🎵 ${name}${artists ? ` · ${artists}` : ''}`;
};

/** The largest https cover in the song API's `image` list, if there is one. */
export const songCover = (songData: Record<string, unknown>): string | null => {
  const images = songData.image;
  if (!Array.isArray(images)) return null;
  for (let i = images.length - 1; i >= 0; i--) {
    const link = (images[i] as { link?: unknown } | null)?.link;
    if (typeof link === 'string' && link.startsWith('https://')) return link;
  }
  return null;
};
