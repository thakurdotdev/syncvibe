import { GroupSessionHistory, Playlist, PlaylistSong, Song } from '@/models/index';
import { musicGroups } from '@/socket/group-music/state';
import { SavedRoomError } from './saved-rooms.service';

/** A playlist holds at most this many songs from one session. */
const MAX_SONGS = 200;

/**
 * Turns what a room played into one of your playlists, in the order it played. Anyone in the
 * room, or who was in it and left, can.
 */
export const saveSessionAsPlaylist = async (userId: number, groupId: string, name?: string) => {
  const group = musicGroups.get(groupId);
  if (!group) throw new SavedRoomError('This room has ended', 404);
  const id = String(userId);
  const wasThere =
    group.members.some((m) => String(m.userId) === id) || Boolean(group.formerMembers[id]);
  if (!wasThere) throw new SavedRoomError('You are not in this room', 403);

  const played = await GroupSessionHistory.findAll({
    where: { groupId },
    order: [['playedAt', 'ASC']],
    include: [{ model: Song, as: 'song', attributes: ['id', 'songId', 'songData'] }],
    limit: 1000,
  });
  const songs: Song[] = [];
  const seen = new Set<number>();
  for (const row of played) {
    const song = (row as GroupSessionHistory & { song?: Song }).song;
    if (!song || seen.has(song.id)) continue;
    seen.add(song.id);
    songs.push(song);
  }
  // What's on now counts too: it may not have finished yet.
  const current = group.current?.song;
  if (current?.id && !songs.some((s) => s.songId === String(current.id))) {
    const song = await Song.getOrCreate(current).catch(() => null);
    if (song && !seen.has(song.id)) songs.push(song);
  }
  if (songs.length === 0) throw new SavedRoomError('Nothing has played in this room yet', 400);

  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const playlist = await Playlist.create({
    userId,
    name: (name?.trim() || `${group.name} · ${date}`).slice(0, 80),
    description: `Played in ${group.name}`,
  });
  await PlaylistSong.bulkCreate(
    songs.slice(0, MAX_SONGS).map((song) => ({
      playlistId: playlist.id,
      songRefId: song.id,
      songId: song.songId,
      songData: song.songData,
    }))
  );
  return {
    playlistId: playlist.id,
    name: playlist.name,
    songCount: Math.min(songs.length, MAX_SONGS),
  };
};
