import type { Server, Socket } from 'socket.io';
import { allowCommand } from '../group-music/commands';
import type { SocketIdentity } from '../auth';
import {
  deviceGone,
  deviceHello,
  playerRoom,
  revsOf,
  runCommand,
  snapshotOf,
  getSession,
  type CommandResult,
  type PlayerCommand,
} from './hub';
import type { DeviceInfo, Resume } from './session';

/*
 * Your own listening across your devices. Only signed-in sockets take part: who you are comes from
 * the session, and which device from the id it says hello with.
 *
 *   player:hello { deviceId, resume? } → { playback, queue, devices }, or { error }
 *       Start following. `resume` is where this device's player is, if it was the one playing
 *       before its connection dropped (see `resume` in session.ts).
 *   player:sync  → { playback, queue, devices }: everything again, after missing an update
 *   player:ping  { } → { serverTime, revs }: clock sync, and revisions to spot a missed update
 *   player:cmd   { type, ... } → { ok, ... }: every change (see `runCommand` in hub.ts)
 */

type Ack<T> = ((response: T) => void) | undefined;
const reply = <T>(ack: Ack<T>, response: T) => {
  if (typeof ack === 'function') ack(response);
};

const DEVICE_ID = /^[A-Za-z0-9_-]{6,80}$/;

const resumeOf = (value: unknown): Resume | undefined => {
  const data = value as Partial<Resume> | undefined;
  if (!data || typeof data.songId !== 'string') return undefined;
  return {
    rev: Number(data.rev),
    songId: data.songId,
    positionMs: Number(data.positionMs),
    playing: data.playing === true,
  };
};

export const setupPlayerHandlers = (io: Server, socket: Socket): void => {
  const identity = (): SocketIdentity | undefined => socket.data.identity;
  const deviceOf = (): DeviceInfo | null => {
    const who = identity();
    const deviceId: string | undefined = socket.data.playerDeviceId;
    if (!who || !deviceId) return null;
    return { deviceId, name: who.device.name, mobile: who.device.mobile };
  };

  socket.on(
    'player:hello',
    async (data: { deviceId?: unknown; resume?: unknown }, ack: Ack<Record<string, unknown>>) => {
      const who = identity();
      if (!who) return reply(ack, { error: 'unauthenticated' });
      const deviceId = typeof data?.deviceId === 'string' ? data.deviceId : '';
      if (!DEVICE_ID.test(deviceId)) return reply(ack, { error: 'invalid' });
      try {
        const userId = String(who.userId);
        socket.data.playerDeviceId = deviceId;
        await socket.join(playerRoom(userId));
        const snapshot = await deviceHello(io, userId, {
          device: { deviceId, name: who.device.name, mobile: who.device.mobile },
          socketId: socket.id,
          resume: resumeOf(data?.resume),
        });
        reply(ack, snapshot);
      } catch (error) {
        console.error('[Player] Hello failed:', error);
        reply(ack, { error: 'failed' });
      }
    }
  );

  socket.on('player:sync', async (_data: unknown, ack: Ack<Record<string, unknown>>) => {
    const who = identity();
    if (!who || !socket.data.playerDeviceId) return reply(ack, { error: 'no-hello' });
    reply(ack, snapshotOf(await getSession(String(who.userId))));
  });

  socket.on('player:ping', async (_data: unknown, ack: Ack<Record<string, unknown>>) => {
    const who = identity();
    if (!who || !socket.data.playerDeviceId) return reply(ack, { serverTime: Date.now() });
    reply(ack, { serverTime: Date.now(), revs: await revsOf(String(who.userId)) });
  });

  socket.on('player:cmd', async (command: PlayerCommand, ack: Ack<CommandResult>) => {
    const device = deviceOf();
    const who = identity();
    if (!device || !who) {
      return reply(ack, { ok: false, code: 'invalid', error: 'Not connected' });
    }
    // Position reports come every few seconds by design; only what a person does is limited.
    if (command?.type !== 'report' && !allowCommand(socket)) {
      return reply(ack, {
        ok: false,
        code: 'invalid',
        error: 'Too many requests. Give it a moment.',
      });
    }
    try {
      reply(ack, await runCommand(io, String(who.userId), device, command ?? { type: '' }));
    } catch (error) {
      console.error('[Player] Command failed:', error);
      reply(ack, { ok: false, code: 'invalid', error: "That didn't work" });
    }
  });

  socket.on('disconnect', () => {
    const who = identity();
    const deviceId: string | undefined = socket.data.playerDeviceId;
    if (who && deviceId) deviceGone(io, String(who.userId), deviceId, socket.id);
  });
};
