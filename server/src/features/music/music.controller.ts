import type { Request, Response } from 'express';
import { fn, col, QueryTypes } from 'sequelize';
import { Playlist, PlaylistSong, Song } from '@/models/index';
import sequelize from '@/utils/sequelize';

export const createPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body as { name: string; description?: string };
    const userId = req.user!.userid;
    const playlist = await Playlist.create({ name, description, userId });
    res.status(200).json({ message: 'Playlist created', data: playlist });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updatePlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, id } = req.body as {
      name: string;
      description?: string;
      id: number;
    };
    const userId = req.user!.userid;
    const playlist = await Playlist.findOne({ where: { id, userId } });
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found' });
      return;
    }

    await Playlist.update({ name, description }, { where: { id } });
    res.status(200).json({ message: 'Playlist updated' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const deletePlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { playlistId } = req.body as { playlistId: number };
    const userId = req.user!.userid;
    const playlist = await Playlist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    await sequelize.transaction(async (transaction) => {
      await PlaylistSong.destroy({ where: { playlistId }, transaction });
      await Playlist.destroy({ where: { id: playlistId }, transaction });
    });

    res.status(200).json({ message: 'Playlist deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const addSongToPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      playlistId,
      songId,
      songData: rawSongData,
    } = req.body as { playlistId: number; songId: string; songData: unknown };
    const userId = req.user!.userid;

    const songData =
      typeof rawSongData === 'string'
        ? (JSON.parse(rawSongData) as Record<string, unknown>)
        : (rawSongData as Record<string, unknown>);

    const playlist = await Playlist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const song = await Song.getOrCreate(songData);

    const alreadyAdded = await PlaylistSong.findOne({ where: { playlistId, songRefId: song.id } });
    if (alreadyAdded) {
      res.status(400).json({ message: 'Song already added to playlist' });
      return;
    }

    await PlaylistSong.create({ playlistId, songRefId: song.id, songId, songData });
    res.status(201).json({ message: 'Song added to playlist' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const removeSongFromPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { playlistId, songId } = req.body as { playlistId: number; songId: string };
    const userId = req.user!.userid;
    const playlist = await Playlist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    await PlaylistSong.destroy({ where: { playlistId, songId } });
    res.status(200).json({ message: 'Song removed from playlist' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getPlaylists = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userid;
    if (!userId) {
      res.status(400).json({ message: 'Invalid user' });
      return;
    }

    const playlists = await Playlist.findAll({
      where: { userId },
      attributes: [
        'id',
        'name',
        'description',
        'createdat',
        [fn('COUNT', col('songs.id')), 'songCount'],
      ],
      include: [{ model: PlaylistSong, as: 'songs', attributes: [] }],
      order: [['createdat', 'DESC']],
      group: ['Playlist.id'],
    });

    const playlistIds = playlists.map((playlist) => playlist.id);
    type PlaylistPreviewRow = {
      playlistId: number;
      playlistSongId: number;
      songRefId: number | null;
      playlistSongData: unknown;
      songData: unknown;
      createdat: Date;
    };

    const previewRows = playlistIds.length
      ? ((await sequelize.query(
          `
            SELECT
              ranked."playlistId" AS "playlistId",
              ranked.id AS "playlistSongId",
              ranked."songRefId" AS "songRefId",
              ranked."songData" AS "playlistSongData",
              s."songData" AS "songData",
              ranked."createdat" AS "createdat"
            FROM (
              SELECT
                ps."playlistId",
                ps.id,
                ps."songRefId",
                ps."songData",
                ps."createdat",
                ROW_NUMBER() OVER (
                  PARTITION BY ps."playlistId"
                  ORDER BY ps."createdat" DESC, ps.id DESC
                ) AS preview_rank
              FROM playlist_songs ps
              WHERE ps."playlistId" IN (:playlistIds)
            ) ranked
            LEFT JOIN songs s ON s.id = ranked."songRefId"
            WHERE ranked.preview_rank <= 5
            ORDER BY ranked."playlistId", ranked."createdat" DESC, ranked.id DESC
          `,
          { replacements: { playlistIds }, type: QueryTypes.SELECT }
        )) as PlaylistPreviewRow[])
      : [];

    const previewsByPlaylist = new Map<number, Array<Record<string, unknown>>>();
    for (const row of previewRows) {
      const rawSongData = row.songData ?? row.playlistSongData;
      let songData: Record<string, unknown> | null = null;

      try {
        songData =
          typeof rawSongData === 'string'
            ? (JSON.parse(rawSongData) as Record<string, unknown>)
            : (rawSongData as Record<string, unknown> | null);
      } catch {
        songData = null;
      }

      if (!songData) continue;

      const preview = {
        id: row.playlistSongId,
        songRefId: row.songRefId,
        name:
          (typeof songData.name === 'string' && songData.name) ||
          (typeof songData.title === 'string' && songData.title) ||
          'Unknown song',
        artistNames:
          (typeof songData.subtitle === 'string' && songData.subtitle) ||
          (typeof songData.artist === 'string' && songData.artist) ||
          null,
        image: songData.image ?? null,
        addedAt: row.createdat,
      };

      const playlistPreviews = previewsByPlaylist.get(row.playlistId) ?? [];
      playlistPreviews.push(preview);
      previewsByPlaylist.set(row.playlistId, playlistPreviews);
    }

    const updatedPlaylists = playlists.map((playlist) => {
      const previewSongs = previewsByPlaylist.get(playlist.id) ?? [];
      const image = previewSongs[0]?.image ?? null;

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        createdat: playlist.createdat,
        songCount: Number(playlist.get('songCount') ?? 0),
        image,
        previewSongs,
        lastAddedAt: previewSongs[0]?.addedAt ?? null,
      };
    });

    res.status(200).json({ message: 'Playlists fetched', data: updatedPlaylists });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getPlaylistSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const playlistId = parseInt(req.query.id as string, 10);
    const userId = req.user!.userid;

    const playlist = await Playlist.findOne({ where: { id: playlistId, userId }, raw: true });
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found' });
      return;
    }

    const songs = await PlaylistSong.findAll({
      where: { playlistId },
      include: [{ model: Song, as: 'song', attributes: ['songData'] }],
      order: [['createdat', 'DESC']],
    });

    const updatedSongs = songs.map((playlistSong) => {
      const songAssoc = (playlistSong as unknown as { song?: { songData: unknown } }).song;
      const songData =
        songAssoc?.songData ??
        (typeof playlistSong.songData === 'string'
          ? JSON.parse(playlistSong.songData as string)
          : playlistSong.songData);
      return {
        id: playlistSong.id,
        playlistId: playlistSong.playlistId,
        songRefId: playlistSong.songRefId,
        songData,
        createdat: playlistSong.createdat,
      };
    });

    const playlistImage = updatedSongs[0]?.songData?.image ?? null;

    res.status(200).json({
      message: 'Playlist songs fetched',
      data: { ...playlist, image: playlistImage, songs: updatedSongs },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
