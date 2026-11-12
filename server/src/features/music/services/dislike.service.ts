import { Song, SongDislike } from '@/models/index';
import { blockedTitlesOf } from './play-next.personal';

type SongData = Record<string, unknown>;

export interface Dislikes {
  songIds: Set<string>;
  /** Clean titles whose other versions are blocked too. */
  titles: Set<string>;
}

const NO_DISLIKES: Dislikes = { songIds: new Set(), titles: new Set() };

/** Everything this listener asked not to hear again. Small: one row per tap. */
export const getDislikes = async (userId: number | null | undefined): Promise<Dislikes> => {
  if (!userId) return NO_DISLIKES;
  const rows = await SongDislike.findAll({
    where: { userId },
    include: [{ model: Song, as: 'song', attributes: ['songId', 'name'] }],
  });
  const songs = rows.flatMap((row) => {
    const song = (row as SongDislike & { song?: Song }).song;
    return song ? [song] : [];
  });
  return {
    songIds: new Set(songs.map((song) => song.songId)),
    titles: blockedTitlesOf(songs.map((song) => song.name || '')),
  };
};

export const dislikeSong = async (userId: number, songData: SongData): Promise<void> => {
  const song = await Song.getOrCreate(songData);
  await SongDislike.findOrCreate({ where: { userId, songRefId: song.id } });
};

export const undoDislike = async (userId: number, songId: string): Promise<void> => {
  const song = await Song.findOne({ where: { songId }, attributes: ['id'] });
  if (!song) return;
  await SongDislike.destroy({ where: { userId, songRefId: song.id } });
};

/** Newest first, as full songs so a list can show and play them. */
export const listDislikedSongs = async (userId: number, limit = 200): Promise<SongData[]> => {
  const rows = await SongDislike.findAll({
    where: { userId },
    include: [{ model: Song, as: 'song', attributes: ['songData'] }],
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.flatMap((row) => {
    const song = (row as SongDislike & { song?: Song }).song;
    return song?.songData ? [song.songData as SongData] : [];
  });
};
