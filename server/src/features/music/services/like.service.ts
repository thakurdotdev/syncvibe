import { Song, SongLike } from '@/models/index';

type SongData = Record<string, unknown>;

export const likeSong = async (userId: number, songData: SongData): Promise<void> => {
  const song = await Song.getOrCreate(songData);
  await SongLike.findOrCreate({ where: { userId, songRefId: song.id } });
};

export const unlikeSong = async (userId: number, songId: string): Promise<void> => {
  const song = await Song.findOne({ where: { songId }, attributes: ['id'] });
  if (!song) return;
  await SongLike.destroy({ where: { userId, songRefId: song.id } });
};

/** Song ids only, so a device can show which hearts are filled without loading every song. */
export const likedSongIds = async (userId: number): Promise<string[]> => {
  const rows = await SongLike.findAll({
    where: { userId },
    include: [{ model: Song, as: 'song', attributes: ['songId'] }],
    order: [['createdAt', 'DESC']],
  });
  return rows.flatMap((row) => {
    const song = (row as SongLike & { song?: Song }).song;
    return song ? [song.songId] : [];
  });
};

/** Newest first, as full songs so a list can show and play them. */
export const listLikedSongs = async (userId: number, limit = 500): Promise<SongData[]> => {
  const rows = await SongLike.findAll({
    where: { userId },
    include: [{ model: Song, as: 'song', attributes: ['songData'] }],
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.flatMap((row) => {
    const song = (row as SongLike & { song?: Song }).song;
    return song?.songData ? [song.songData as SongData] : [];
  });
};
