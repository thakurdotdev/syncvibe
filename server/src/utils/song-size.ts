/** Catalog songs are a few KB and the largest about 70 KB. */
export const MAX_SONG_LENGTH = 128 * 1024;

/** Songs arrive from devices and are kept in memory, so one can't be arbitrarily large. */
export const fitsSongLimit = (song: object): boolean =>
  JSON.stringify(song).length <= MAX_SONG_LENGTH;
