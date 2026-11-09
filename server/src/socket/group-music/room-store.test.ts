import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserializeRoom, serializeCore, serializeQueue } from './room-store';
import { createGroupState } from './state';
import { createQueueItem } from './queue';
import { playFrom } from './timeline';

const room = () => {
  const group = createGroupState({
    id: 'g1',
    name: 'Room',
    createdBy: 1,
    userName: 'Host',
    profilePic: 'pic',
  });
  const by = group.members[0]!;
  group.current = createQueueItem({ id: 'a', duration: 200 }, by);
  group.upcoming = [createQueueItem({ id: 'b' }, by), createQueueItem({ id: 'c' }, by)];
  group.timeline = playFrom(42_000, 1_000_000);
  group.revs = { playback: 7, queue: 4, meta: 2 };
  group.recentSongIds = ['z'];
  group.settings.controlMode = 'host';
  group.qrCode = 'qr';
  return group;
};

test('a room comes back from storage as it was', () => {
  const group = room();
  group.rtt.set('socket', { ms: 40, at: 1 });
  group.endTimer = setTimeout(() => {}, 0);
  group.advancing = true;

  const restored = deserializeRoom({ core: serializeCore(group), queue: serializeQueue(group) })!;
  clearTimeout(group.endTimer);

  assert.deepEqual(restored.timeline, group.timeline);
  assert.deepEqual(restored.revs, group.revs);
  assert.deepEqual(restored.current, group.current);
  assert.deepEqual(restored.upcoming, group.upcoming);
  assert.deepEqual(restored.members, group.members);
  assert.deepEqual(restored.settings, group.settings);
  assert.equal(restored.createdBy, 1);
  assert.equal(restored.qrCode, 'qr');
  assert.deepEqual(restored.recentSongIds, ['z']);
});

test('what belongs to the old process is not stored', () => {
  const group = room();
  group.rtt.set('socket', { ms: 40, at: 1 });
  group.advancing = true;
  group.isFetchingRecommendations = true;

  const stored = serializeCore(group);
  assert.ok(
    !stored.includes('rtt') && !stored.includes('advancing') && !stored.includes('endTimer')
  );

  const restored = deserializeRoom({ core: stored, queue: serializeQueue(group) })!;
  assert.equal(restored.rtt.size, 0);
  assert.equal(restored.advancing, undefined);
  assert.equal(restored.isFetchingRecommendations, undefined);
});

test('a room without its queue part, or unreadable, is handled', () => {
  const group = room();
  assert.deepEqual(deserializeRoom({ core: serializeCore(group) })!.upcoming, []);
  assert.equal(deserializeRoom({}), null);
  assert.equal(deserializeRoom({ core: '{not json' }), null);
  assert.equal(deserializeRoom({ core: '{"id":5}' }), null);
});
