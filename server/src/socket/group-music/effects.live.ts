import { Song, GroupSessionHistory } from '@/models/index';
import { getPlayNextSongs } from '@/features/music/services/play-next.service';
import { effects } from './effects';

effects.recommend = (options) => getPlayNextSongs(options);

effects.recordPlayed = async (group, queueItem) => {
  if (!queueItem?.song?.id) return;
  try {
    const songRecord = await Song.getOrCreate(queueItem.song);
    if (!songRecord) return;
    await GroupSessionHistory.create({
      sessionId: group.id,
      groupId: group.id,
      songRefId: songRecord.id,
      addedByUserId: queueItem.addedBy?.userId
        ? parseInt(String(queueItem.addedBy.userId), 10) || null
        : null,
      playedAt: new Date(),
    });
  } catch (err) {
    console.error('[GroupHistory] Failed to persist:', (err as Error).message);
  }
};
