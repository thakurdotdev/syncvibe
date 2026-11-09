import type { Server, Socket } from 'socket.io';
import { legacySyncState } from './broadcast';
import { allowCommand, resolveMember, runCommand, type RoomCommand } from './commands';

/*
 * App and web versions from before the current protocol. Their events are turned into the same
 * requests newer versions make, so both kinds of device share one room and one set of rules.
 * Remove once no installed app is old enough to need them.
 */

/** An old app reports a song ending as a skip. Soon after a song starts, it's a late duplicate. */
const LATE_END_WINDOW_MS = 3000;

export const setupLegacyHandlers = (io: Server, socket: Socket, userId: string | number): void => {
  const run = async (groupId: string, command: Omit<RoomCommand, 'groupId'>) => {
    try {
      const found = resolveMember(socket, userId, groupId);
      if ('code' in found || !allowCommand(socket)) return;
      const result = await runCommand(io, found.group, found.member, { groupId, ...command });
      if (!result.ok) socket.emit('queue-error', { error: result.error });
    } catch (err) {
      console.error('[GroupMusic] Command failed:', err);
    }
  };

  socket.on('time-sync-request', (data: { clientTime: number }) => {
    socket.emit('time-sync-response', {
      clientTime: data?.clientTime,
      serverTime: Date.now(),
    });
  });

  // These checks run every few seconds, so they also catch a device that has lost its place:
  // the room has ended, or this connection never got back into it after a reconnect.
  socket.on('request-sync', (data: { groupId: string }) => {
    const found = resolveMember(socket, userId, data?.groupId);
    if ('code' in found) {
      socket.emit('sync-lost', {
        groupId: data?.groupId,
        reason: found.code === 'gone' ? 'group-gone' : 'not-in-room',
      });
      return;
    }
    socket.emit('sync-state', legacySyncState(found.group));
  });

  socket.on('music-change', (data: { groupId: string; song: Record<string, unknown> }) =>
    run(data?.groupId, { type: 'play-now', song: data?.song })
  );

  socket.on('music-playback', (data: { groupId: string; isPlaying: boolean }) =>
    run(data?.groupId, { type: data?.isPlaying ? 'play' : 'pause' })
  );

  socket.on('music-seek', (data: { groupId: string; currentTime: number }) =>
    run(data?.groupId, { type: 'seek', positionMs: Number(data?.currentTime) * 1000 })
  );

  socket.on('add-to-queue', (data: { groupId: string; song: Record<string, unknown> }) =>
    run(data?.groupId, { type: 'add', song: data?.song })
  );

  socket.on('play-next', (data: { groupId: string; song: Record<string, unknown> }) =>
    run(data?.groupId, { type: 'add-next', song: data?.song })
  );

  socket.on(
    'add-playlist-to-queue',
    (data: { groupId: string; songs: Array<Record<string, unknown>> }) =>
      run(data?.groupId, { type: 'add-many', songs: data?.songs })
  );

  socket.on('remove-from-queue', (data: { groupId: string; queueItemId: string }) =>
    run(data?.groupId, { type: 'remove', itemId: data?.queueItemId })
  );

  socket.on('skip-song', (data: { groupId: string }) => {
    const found = resolveMember(socket, userId, data?.groupId);
    if ('code' in found) return;
    if (Date.now() - found.group.trackStartedAt < LATE_END_WINDOW_MS) return;
    return run(data.groupId, { type: 'skip' });
  });

  socket.on('song-ended', (data: { groupId: string; songId?: string }) =>
    run(data?.groupId, { type: 'ended', itemId: data?.songId })
  );

  socket.on('clear-queue', (data: { groupId: string }) => run(data?.groupId, { type: 'clear' }));

  socket.on('toggle-auto-recommendations', (data: { groupId: string; enabled?: boolean }) =>
    run(data?.groupId, { type: 'set-autoplay', enabled: data?.enabled })
  );

  // Positions counted the current song as the first entry.
  socket.on('reorder-queue', (data: { groupId: string; fromIndex: number; toIndex: number }) => {
    const found = resolveMember(socket, userId, data?.groupId);
    if ('code' in found) return;
    const shift = found.group.current ? 1 : 0;
    const item = found.group.upcoming[data.fromIndex - shift];
    if (!item) return socket.emit('queue-error', { error: 'Invalid index' });
    return run(data.groupId, { type: 'move', itemId: item.id, toIndex: data.toIndex - shift });
  });
};
