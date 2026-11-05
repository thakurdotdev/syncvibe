import type { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { Song } from '@/models/index';
import sequelize from '@/utils/sequelize';
import {
  MAX_EVENTS_PER_REQUEST,
  completionPercent,
  isSkip,
  parsePlayEvent,
  type PlayEventInput,
} from './play-events.validation';

const saveEvent = async (
  userId: number,
  songRefId: number,
  songDurationMs: number | null,
  event: PlayEventInput
): Promise<boolean> =>
  sequelize.transaction(async (transaction) => {
    const durationMs = songDurationMs || event.durationMs;
    const inserted = await sequelize.query(
      `
      INSERT INTO play_events (
        "eventId", "userId", "songRefId", "sessionId", source, "seedSongId", position,
        "startedAt", "playedMs", "durationMs", "endReason", platform
      )
      VALUES (
        :eventId, :userId, :songRefId, :sessionId, :source, :seedSongId, :position,
        :startedAt, :playedMs, :durationMs, :endReason, :platform
      )
      ON CONFLICT ("eventId") DO NOTHING
      RETURNING id
      `,
      {
        replacements: {
          eventId: event.eventId,
          userId,
          songRefId,
          sessionId: event.sessionId,
          source: event.source,
          seedSongId: event.seedSongId,
          position: event.position,
          startedAt: event.startedAt,
          playedMs: event.playedMs,
          durationMs,
          endReason: event.endReason,
          platform: event.platform,
        },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
    if (inserted.length === 0) return false;

    const playedSeconds = Math.round(event.playedMs / 1000);
    await sequelize.query(
      `
      UPDATE history_songs SET
        "playedTime" = :playedSeconds,
        "totalPlayTime" = COALESCE("totalPlayTime", 0) + :playedSeconds,
        "completionRate" = :completionRate,
        "skipCount" = COALESCE("skipCount", 0) + :skips
      WHERE "userId" = :userId AND "songRefId" = :songRefId
      `,
      {
        replacements: {
          userId,
          songRefId,
          playedSeconds,
          completionRate: completionPercent(event.playedMs, durationMs),
          skips: isSkip(event) ? 1 : 0,
        },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );
    return true;
  });

export const recordPlayEvents = async (req: Request, res: Response): Promise<void> => {
  const rawEvents = (req.body as { events?: unknown } | undefined)?.events;
  if (!Array.isArray(rawEvents) || rawEvents.length > MAX_EVENTS_PER_REQUEST) {
    res.status(400).json({ success: false, error: 'Invalid events' });
    return;
  }

  try {
    const userId = req.user!.userid;
    const events = rawEvents
      .map((raw) => parsePlayEvent(raw))
      .filter((event): event is PlayEventInput => event !== null);

    const songs = await Song.findAll({
      where: { songId: { [Op.in]: [...new Set(events.map((event) => event.songId))] } },
      attributes: ['id', 'songId', 'duration'],
      raw: true,
    });
    const songsById = new Map(songs.map((song) => [song.songId, song]));

    let saved = 0;
    for (const event of events) {
      const song = songsById.get(event.songId);
      if (!song) continue;
      const durationMs = song.duration ? song.duration * 1000 : null;
      if (await saveEvent(userId, song.id, durationMs, event)) saved += 1;
    }

    res.json({ success: true, data: { received: rawEvents.length, saved } });
  } catch (error) {
    console.error('Error recording play events:', error);
    res.status(500).json({ success: false, error: 'Failed to record play events' });
  }
};
