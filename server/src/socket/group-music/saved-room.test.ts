import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserializeRoom, serializeCore, serializeQueue } from './room-store';
import { applySavedSettings, mergeRegulars, savedSnapshotOf } from './saved-room';
import { createGroupState, type MusicGroup } from './state';
import { createQueueItem } from './queue';

const room = (): MusicGroup => {
  const group = createGroupState({ id: 'g', name: 'Friday', createdBy: 1, userName: 'Host' });
  group.members.push(
    { userId: 2, userName: 'Aarav' },
    { userId: 3, userName: 'Meera', profilePic: 'm.jpg' }
  );
  return group;
};

test('regulars: everyone here now first, then those from before, never the owner', () => {
  const group = room();
  const known = [
    { userId: '9', userName: 'Old friend' },
    { userId: '2', userName: 'Aarav (old name)' },
  ];
  assert.deepEqual(
    mergeRegulars(known, group, '1').map((r) => [r.userId, r.userName]),
    [
      ['2', 'Aarav'],
      ['3', 'Meera'],
      ['9', 'Old friend'],
    ]
  );
});

test('a snapshot keeps the setup and what is on and queued, in order', () => {
  const group = room();
  group.settings.fairQueue = true;
  group.settings.controlMode = 'host';
  group.coHosts = ['3'];
  group.current = createQueueItem({ id: 'a', name: 'A' }, group.members[0]!);
  group.upcoming = [createQueueItem({ id: 'b', name: 'B' }, group.members[1]!)];

  const snapshot = savedSnapshotOf(group, '1');
  assert.equal(snapshot.name, 'Friday');
  assert.deepEqual(snapshot.coHostIds, ['3']);
  assert.deepEqual(
    snapshot.queue.map((s) => s.id),
    ['a', 'b']
  );
  assert.equal(snapshot.settings.fairQueue, true);
  assert.equal(snapshot.settings.controlMode, 'host');
});

test('a reopened room takes the kept setup but not a bad value', () => {
  const group = room();
  applySavedSettings(group, { controlMode: 'host', fairQueue: true, approveSongs: true });
  assert.equal(group.settings.controlMode, 'host');
  assert.equal(group.settings.fairQueue, true);
  assert.equal(group.settings.approveSongs, true);
  applySavedSettings(group, { controlMode: 'nobody' as never });
  assert.equal(group.settings.controlMode, 'host');
});

test('the link to a kept room survives a restart', () => {
  const group = room();
  group.savedRoom = { id: 7, ownerId: '1', regulars: [{ userId: '2', userName: 'Aarav' }] };
  const back = deserializeRoom({ core: serializeCore(group), queue: serializeQueue(group) });
  assert.deepEqual(back?.savedRoom, group.savedRoom);
  delete group.savedRoom;
  const plain = deserializeRoom({ core: serializeCore(group), queue: serializeQueue(group) });
  assert.equal(plain?.savedRoom, undefined);
});
