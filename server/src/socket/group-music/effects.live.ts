import { GroupSessionHistory, SavedRoom } from '@/models/index';
import { catalogSong } from '@/features/music/services/catalog.service';
import { getPlayNextForRoom } from '@/features/music/services/play-next.service';
import { effects } from './effects';
import { savedSnapshotOf } from './saved-room';

effects.recommend = (options) => getPlayNextForRoom(options);

effects.recordPlayed = async (group, queueItem) => {
  if (!queueItem?.song?.id) return;
  try {
    const songRecord = await catalogSong(queueItem.song);
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

effects.saveRoom = async (group, ended) => {
  const link = group.savedRoom;
  if (!link) return;
  try {
    const snapshot = savedSnapshotOf(group, link.ownerId);
    link.regulars = snapshot.regulars;
    await SavedRoom.update(
      { ...snapshot, liveGroupId: ended ? null : group.id },
      // A room opened again since then has moved on; this one mustn't overwrite it.
      { where: ended ? { id: link.id, liveGroupId: group.id } : { id: link.id } }
    );
  } catch (err) {
    console.error('[SavedRoom] Failed to save:', (err as Error).message);
  }
};
