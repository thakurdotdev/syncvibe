import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server } from 'socket.io';
import { runCommand, type RoomCommand } from './commands';
import { effects } from './effects';
import { handleMemberGone } from './host';
import { deserializeRoom, serializeCore } from './room-store';
import { createGroupState, musicGroups, skipVotesNeeded } from './state';

const GROUP = 'g1';
const HOST = 1;
const CO = 2;
const GUEST = 3;
const OTHER = 4;

const song = (id: string) => ({ id, name: `Song ${id}`, duration: 200 });

const setup = () => {
  const sent: { room: string; event: string; payload: any }[] = [];
  const left: { room: string; rooms: string[] }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => sent.push({ room, event, payload }),
    }),
    in: (room: string) => ({ socketsLeave: (rooms: string[]) => left.push({ room, rooms }) }),
  } as unknown as Server;

  const group = createGroupState({
    id: GROUP,
    name: 'Room',
    createdBy: HOST,
    userName: 'Host',
    planLimits: { realtimeSyncEnabled: true, maxGroupMembers: 10 } as any,
  });
  group.settings.autoPlayRecommendations = false;
  group.members.push(
    { userId: CO, userName: 'Co' },
    { userId: GUEST, userName: 'Guest' },
    { userId: OTHER, userName: 'Other' }
  );
  musicGroups.set(GROUP, group);

  const cmd = (userId: number, command: Omit<RoomCommand, 'groupId'>) =>
    runCommand(
      io,
      group,
      group.members.find((m) => m.userId === userId)!,
      {
        groupId: GROUP,
        ...command,
      }
    );
  return { io, group, cmd, sent, left };
};

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
});
afterEach(() => {
  mock.timers.reset();
  musicGroups.clear();
  effects.recommend = async () => [];
});

test('co-hosts control playback in host-only mode; only the host makes them', async () => {
  const { group, cmd } = setup();
  await cmd(HOST, { type: 'set-control-mode', mode: 'host' });
  await cmd(HOST, { type: 'add', song: song('a') });

  assert.equal((await cmd(CO, { type: 'pause' })).ok, false);
  assert.equal((await cmd(GUEST, { type: 'set-cohost', userId: CO })).ok, false);
  assert.equal((await cmd(HOST, { type: 'set-cohost', userId: CO })).ok, true);
  assert.deepEqual(group.coHosts, [String(CO)]);

  assert.equal((await cmd(CO, { type: 'pause' })).ok, true);
  assert.equal((await cmd(CO, { type: 'set-control-mode', mode: 'everyone' })).ok, false);
  assert.equal((await cmd(CO, { type: 'set-cohost', userId: GUEST })).ok, false);

  await cmd(HOST, { type: 'set-cohost', userId: CO, enabled: false });
  assert.equal((await cmd(CO, { type: 'play' })).ok, false);
});

test('co-hosts can remove anyone’s song from the queue', async () => {
  const { group, cmd } = setup();
  await cmd(GUEST, { type: 'add', song: song('a') });
  await cmd(GUEST, { type: 'add', song: song('b') });
  const item = group.upcoming[0]!;
  assert.equal((await cmd(CO, { type: 'remove', itemId: item.id })).ok, false);
  await cmd(HOST, { type: 'set-cohost', userId: CO });
  assert.equal((await cmd(CO, { type: 'remove', itemId: item.id })).ok, true);
});

test('muting and removing follow rank: host over co-hosts over listeners', async () => {
  const { group, cmd, sent, left } = setup();
  await cmd(HOST, { type: 'set-cohost', userId: CO });

  assert.equal((await cmd(GUEST, { type: 'mute', userId: OTHER })).code, 'host-only');
  assert.equal((await cmd(CO, { type: 'mute', userId: HOST })).code, 'not-allowed');
  assert.equal((await cmd(CO, { type: 'mute', userId: CO })).code, 'not-allowed');
  assert.equal((await cmd(CO, { type: 'mute', userId: GUEST })).ok, true);
  assert.deepEqual(group.mutedIds, [String(GUEST)]);
  assert.equal((await cmd(HOST, { type: 'mute', userId: CO })).ok, true);
  await cmd(HOST, { type: 'mute', userId: CO, enabled: false });
  assert.deepEqual(group.mutedIds, [String(GUEST)]);

  assert.equal((await cmd(CO, { type: 'remove-member', userId: OTHER })).ok, true);
  assert.equal(
    group.members.some((m) => m.userId === OTHER),
    false
  );
  assert.deepEqual(group.removedIds, [String(OTHER)]);
  const told = sent.find((s) => s.room === String(OTHER) && s.event === 'left-group');
  assert.deepEqual(told?.payload, { groupId: GROUP, removed: true });
  assert.equal(left[0]?.room, String(OTHER));
});

test('a co-host takes over when the host leaves; giving the room away keeps you as co-host', async () => {
  const { group, cmd } = setup();
  await cmd(HOST, { type: 'set-cohost', userId: GUEST });
  group.members = group.members.filter((m) => m.userId !== HOST);
  handleMemberGone({ to: () => ({ emit() {} }) } as unknown as Server, group, HOST);
  assert.equal(group.createdBy, GUEST);
  assert.deepEqual(group.coHosts, []);

  assert.equal((await cmd(GUEST, { type: 'transfer-host', userId: CO })).ok, true);
  assert.equal(group.createdBy, CO);
  assert.deepEqual(group.coHosts, [String(GUEST)]);
});

test('enough votes skip the song; votes lapse with it', async () => {
  const { group, cmd } = setup();
  await cmd(HOST, { type: 'set-control-mode', mode: 'host' });
  await cmd(HOST, { type: 'add', song: song('a') });
  await cmd(HOST, { type: 'add', song: song('b') });
  const first = group.current!;
  assert.equal(skipVotesNeeded(group), 2);

  assert.equal((await cmd(GUEST, { type: 'skip', itemId: first.id })).ok, false);
  assert.equal((await cmd(GUEST, { type: 'vote-skip', itemId: first.id })).ok, true);
  assert.equal(group.current, first);
  assert.deepEqual(group.skipVotes?.userIds, [String(GUEST)]);

  // Voting again takes it back.
  await cmd(GUEST, { type: 'vote-skip', itemId: first.id });
  assert.equal(group.skipVotes, null);

  await cmd(GUEST, { type: 'vote-skip', itemId: first.id });
  await cmd(OTHER, { type: 'vote-skip', itemId: first.id });
  assert.notEqual(group.current, first);
  assert.equal(group.skipVotes, null);

  assert.equal((await cmd(OTHER, { type: 'vote-skip', itemId: first.id })).code, 'not-found');
});

test('a vote from someone who leaves stops counting', async () => {
  const { group, cmd } = setup();
  await cmd(HOST, { type: 'add', song: song('a') });
  const first = group.current!;
  await cmd(GUEST, { type: 'vote-skip', itemId: first.id });
  group.members = group.members.filter((m) => m.userId !== GUEST);
  handleMemberGone({ to: () => ({ emit() {} }) } as unknown as Server, group, GUEST);
  assert.deepEqual(group.skipVotes?.userIds, []);
});

test('co-hosts, mutes, removals and votes survive a restart', async () => {
  const { group, cmd } = setup();
  await cmd(HOST, { type: 'set-cohost', userId: CO });
  await cmd(HOST, { type: 'mute', userId: GUEST });
  await cmd(HOST, { type: 'remove-member', userId: OTHER });
  await cmd(HOST, { type: 'add', song: song('a') });
  await cmd(GUEST, { type: 'vote-skip', itemId: group.current!.id });

  const restored = deserializeRoom({ core: serializeCore(group) })!;
  assert.deepEqual(restored.coHosts, [String(CO)]);
  assert.deepEqual(restored.mutedIds, [String(GUEST)]);
  assert.deepEqual(restored.removedIds, [String(OTHER)]);
  assert.deepEqual(restored.skipVotes, group.skipVotes);

  const old = JSON.parse(serializeCore(group));
  delete old.coHosts;
  delete old.mutedIds;
  delete old.removedIds;
  delete old.skipVotes;
  const fromOld = deserializeRoom({ core: JSON.stringify(old) })!;
  assert.deepEqual(fromOld.coHosts, []);
  assert.equal(fromOld.skipVotes, null);
});
