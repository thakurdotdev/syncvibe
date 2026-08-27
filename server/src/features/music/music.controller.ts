import type { Request, Response } from 'express';
import { fn, col } from 'sequelize';
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
      include: [
        { model: PlaylistSong, as: 'songs', attributes: [] },
        {
          model: PlaylistSong,
          as: 'latestSong',
          attributes: ['songData'],
          order: [['createdat', 'DESC']],
          limit: 1,
        },
      ],
      group: ['Playlist.id'],
    });

    const updatedPlaylists = playlists.map((playlist) => {
      const latestSong = (playlist as unknown as { latestSong?: Array<{ songData: unknown }> })
        .latestSong?.[0];
      const songData = latestSong?.songData ?? null;
      const parsedSongData =
        typeof songData === 'string'
          ? (JSON.parse(songData) as Record<string, unknown>)
          : (songData as Record<string, unknown> | null);
      const image = parsedSongData?.image ?? null;

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        createdat: playlist.createdat,
        songCount: playlist.get('songCount'),
        image,
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
