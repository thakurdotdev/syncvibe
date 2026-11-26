import { SavedRoom } from '@/models/index';
import { getIO } from '@/utils/socket-emitter';
import { metaChanged } from '@/socket/group-music/host';
import { touchRoom } from '@/socket/group-music/room-store';
import { MAX_SAVED_ROOMS, savedSnapshotOf } from '@/socket/group-music/saved-room';
import { isHost, musicGroups } from '@/socket/group-music/state';

/*
 * Rooms a host keeps between sessions. Saving links the live room to a saved_rooms row, which
 * then follows it (see `followSavedRoom`); opening one again is `create-music-group` with its id.
 */

export class SavedRoomError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const imageOf = (song: Record<string, unknown>): string | null => {
  const image = song.image as Array<{ link?: string }> | string | undefined;
  if (typeof image === 'string') return image;
  return image?.[1]?.link ?? image?.[0]?.link ?? null;
};

/** The live room a kept one is playing in right now, if any. */
const liveRoomOf = (row: SavedRoom) => {
  const group = row.liveGroupId ? musicGroups.get(row.liveGroupId) : undefined;
  return group?.savedRoom?.id === row.id ? group : undefined;
};

export const listSavedRooms = async (ownerId: number) => {
  const rows = await SavedRoom.findAll({
    where: { ownerId },
    order: [['updatedAt', 'DESC']],
    limit: MAX_SAVED_ROOMS,
  });
  return rows.map((row) => {
    const live = liveRoomOf(row);
    const covers = [
      ...new Set(row.queue.map(imageOf).filter((link): link is string => Boolean(link))),
    ].slice(0, 4);
    return {
      id: row.id,
      name: row.name,
      songCount: row.queue.length,
      covers,
      regulars: row.regulars.slice(0, 8),
      regularCount: row.regulars.length,
      live: live ? { groupId: live.id, listeners: live.members.length } : null,
      updatedAt: row.updatedAt,
    };
  });
};

/** Keeps a live room. Only its host can, and keeping it twice changes nothing. */
export const saveLiveRoom = async (ownerId: number, groupId: string) => {
  const group = musicGroups.get(groupId);
  if (!group) throw new SavedRoomError('This room has ended', 404);
  if (!isHost(group, ownerId)) throw new SavedRoomError('Only the host can keep the room', 403);
  if (group.savedRoom) return { id: group.savedRoom.id };

  const count = await SavedRoom.count({ where: { ownerId } });
  if (count >= MAX_SAVED_ROOMS) {
    throw new SavedRoomError(`You can keep up to ${MAX_SAVED_ROOMS} rooms. Remove one first.`, 409);
  }

  const snapshot = savedSnapshotOf(group, String(ownerId));
  const row = await SavedRoom.create({ ownerId, ...snapshot, liveGroupId: group.id });
  group.savedRoom = { id: row.id, ownerId: String(ownerId), regulars: snapshot.regulars };
  touchRoom(group, 'core');
  const io = getIO();
  if (io) metaChanged(io, group);
  return { id: row.id };
};

/** Stops keeping a room. A live one carries on, just no longer kept. */
export const deleteSavedRoom = async (ownerId: number, id: number): Promise<void> => {
  const row = await SavedRoom.findOne({ where: { id, ownerId } });
  if (!row) throw new SavedRoomError('Room not found', 404);
  const live = liveRoomOf(row);
  await row.destroy();
  if (!live) return;
  delete live.savedRoom;
  touchRoom(live, 'core');
  const io = getIO();
  if (io) metaChanged(io, live);
};

export const renameSavedRoom = async (ownerId: number, id: number, name: string) => {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new SavedRoomError('Give the room a name', 400);
  const row = await SavedRoom.findOne({ where: { id, ownerId } });
  if (!row) throw new SavedRoomError('Room not found', 404);
  await row.update({ name: clean });
  const live = liveRoomOf(row);
  if (live) {
    live.name = clean;
    touchRoom(live, 'core');
    const io = getIO();
    if (io) metaChanged(io, live);
  }
  return { id: row.id, name: clean };
};
