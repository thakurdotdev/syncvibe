import type { TasteArtist } from '@/models/music/music-taste.model';

export interface Taste {
  languages: string[];
  artists: TasteArtist[];
  shareListening: boolean;
}

/** The ones the catalog holds enough of to recommend from. */
export const LANGUAGES = [
  'hindi',
  'english',
  'punjabi',
  'bhojpuri',
  'haryanvi',
  'tamil',
  'telugu',
  'marathi',
  'gujarati',
  'bengali',
  'kannada',
  'malayalam',
  'rajasthani',
  'odia',
  'assamese',
  'urdu',
] as const;
const MAX_ARTISTS = 20;

export const EMPTY_TASTE: Taste = { languages: [], artists: [], shareListening: true };

/** Drops what isn't a known language or a well-formed artist, rather than refusing the lot. */
export const cleanTaste = (input: Partial<Record<keyof Taste, unknown>>, current: Taste): Taste => {
  const known = new Set<string>(LANGUAGES);
  const languages = Array.isArray(input.languages)
    ? [
        ...new Set(
          input.languages
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
            .filter((value) => known.has(value))
        ),
      ]
    : current.languages;

  const artists = Array.isArray(input.artists)
    ? [
        ...new Map(
          input.artists
            .filter(
              (value): value is TasteArtist =>
                !!value &&
                typeof value === 'object' &&
                typeof (value as TasteArtist).id === 'string' &&
                typeof (value as TasteArtist).name === 'string'
            )
            .map((artist) => [
              artist.id,
              {
                id: artist.id.slice(0, 64),
                name: artist.name.trim().slice(0, 200),
                image: typeof artist.image === 'string' ? artist.image.slice(0, 500) : null,
              },
            ])
        ).values(),
      ]
        .filter((artist) => artist.name)
        .slice(0, MAX_ARTISTS)
    : current.artists;

  const shareListening =
    typeof input.shareListening === 'boolean' ? input.shareListening : current.shareListening;

  return { languages, artists, shareListening };
};
