import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { GroupSessionHistory, Song, User, GroupInvite } from '@/models/index';

export const getLastSessionSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.query.userId as string, 10);
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const latestAddedEntry = await GroupSessionHistory.findOne({
      where: { addedByUserId: userId },
      order: [['playedAt', 'DESC']],
      attributes: ['sessionId', 'playedAt'],
      raw: true,
    });

    const latestInvite = await GroupInvite.findOne({
      where: { [Op.or]: [{ inviterId: userId }, { inviteeId: userId, status: 'accepted' }] },
      order: [['updatedAt', 'DESC']],
      attributes: ['groupId', 'updatedAt'],
      raw: true,
    });

    let targetSessionId: string | null = null;
    if (latestAddedEntry && latestInvite) {
      const addedTime = new Date(latestAddedEntry.playedAt).getTime();
      const inviteTime = new Date(latestInvite.updatedAt).getTime();
      targetSessionId = addedTime >= inviteTime ? latestAddedEntry.sessionId : latestInvite.groupId;
    } else if (latestAddedEntry) {
      targetSessionId = latestAddedEntry.sessionId;
    } else if (latestInvite) {
      targetSessionId = latestInvite.groupId;
    }

    if (!targetSessionId) {
      res.json({ success: true, data: [] });
      return;
    }

    const songs = await GroupSessionHistory.findAll({
      where: { sessionId: targetSessionId },
      include: [
        { model: Song, as: 'song', attributes: ['songId', 'name', 'artistNames', 'songData'] },
        { model: User, as: 'addedBy', attributes: ['userid', 'name', 'profilepic'] },
      ],
      order: [['playedAt', 'ASC']],
      limit: 50,
    });

    const result = songs.map((entry) => {
      const song = (
        entry as unknown as {
          song?: {
            songData?: Record<string, unknown>;
            songId: string;
            name: string;
            artistNames: string;
          };
        }
      ).song;
      const addedBy = (
        entry as unknown as { addedBy?: { userid: number; name: string; profilepic: string } }
      ).addedBy;
      return {
        id: song?.songData?.id ?? song?.songId,
        name: song?.name,
        artist: song?.artistNames,
        songData: song?.songData,
        addedBy: addedBy
          ? { userId: addedBy.userid, name: addedBy.name, profilePic: addedBy.profilepic }
          : null,
        playedAt: entry.playedAt,
        reactionCount: entry.reactionCount,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[GroupHistory] Error:', (error as Error).message);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
