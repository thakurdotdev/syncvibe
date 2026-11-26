import type { Request, Response } from 'express';
import {
  deleteSavedRoom,
  listSavedRooms,
  renameSavedRoom,
  SavedRoomError,
  saveLiveRoom,
} from './services/saved-rooms.service';
import { saveSessionAsPlaylist } from './services/session-playlist.service';

const handle =
  (where: string, run: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({ success: true, data: await run(req) });
    } catch (error) {
      if (error instanceof SavedRoomError) {
        res.status(error.status).json({ success: false, error: error.message });
        return;
      }
      console.error(`Error in ${where}:`, error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Something went wrong' });
    }
  };

const idOf = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new SavedRoomError('Room not found', 404);
  return id;
};

const groupIdOf = (value: unknown) => {
  if (typeof value !== 'string' || !/^[\w-]{1,64}$/.test(value)) {
    throw new SavedRoomError('Room not found', 404);
  }
  return value;
};

export const getSavedRooms = handle('getSavedRooms', (req) => listSavedRooms(req.user!.userid));

export const postSavedRoom = handle('postSavedRoom', (req) =>
  saveLiveRoom(req.user!.userid, groupIdOf((req.body as { groupId?: unknown })?.groupId))
);

export const patchSavedRoom = handle('patchSavedRoom', (req) =>
  renameSavedRoom(req.user!.userid, idOf(req), String((req.body as { name?: unknown })?.name ?? ''))
);

export const removeSavedRoom = handle('removeSavedRoom', async (req) => {
  await deleteSavedRoom(req.user!.userid, idOf(req));
  return null;
});

export const postSessionPlaylist = handle('postSessionPlaylist', (req) =>
  saveSessionAsPlaylist(
    req.user!.userid,
    groupIdOf(req.params.groupId),
    typeof (req.body as { name?: unknown })?.name === 'string'
      ? (req.body as { name: string }).name
      : undefined
  )
);
