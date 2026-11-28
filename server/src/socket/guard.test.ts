import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket } from 'socket.io';
import { containListenerErrors } from './guard';

const guarded = () => {
  const emitter = new EventEmitter();
  containListenerErrors(emitter as unknown as Socket);
  return emitter;
};

test('a listener that throws or rejects fails alone', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const socket = guarded();
  socket.on('sync', ({ groupId }: { groupId: string }) => groupId);
  socket.on('async', async () => {
    throw new Error('nope');
  });

  assert.doesNotThrow(() => socket.emit('sync', undefined));
  socket.emit('async');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logged.mock.callCount(), 2);
});

test('a guarded listener still gets its arguments and can be taken off', () => {
  const socket = guarded();
  const seen: unknown[] = [];
  const listener = (...args: unknown[]) => seen.push(args);
  socket.on('event', listener);
  socket.emit('event', 1, 2);
  socket.removeListener('event', listener);
  socket.emit('event', 3);
  assert.deepEqual(seen, [[1, 2]]);
});
