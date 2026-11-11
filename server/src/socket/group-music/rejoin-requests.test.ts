import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Server } from 'socket.io';
import { pendingRequestsOf } from './former';
import { removeFromRoom, setCoHost } from './moderation';
import { ASK_COOLDOWN_MS, answerRejoin, askToRejoin } from './rejoin-requests';
import { createGroupState, musicGroups, userGroups, type MusicGroup } from './state';

const GROUP = 'g1';
const START = 1_000_000;

const setup = () => {
  const told: { room: string; event: string; payload: any }[] = [];
  const io = {
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    to: (room: string) => ({
      emit: (event: string, payload: any) => told.push({ room, event, payload }),
    }),
    in: () => ({ socketsLeave: () => {} }),
  } as unknown as Server;

  const group = createGroupState({ id: GROUP, name: 'Friday', createdBy: 'host', userName: 'H' });
  group.maxMembers = 10;
  group.members.push(
    { userId: 'co', userName: 'Co' },
    { userId: 'b', userName: 'B' },
    { userId: 'c', userName: 'C' }
  );
  musicGroups.set(GROUP, group);
  const as = (userId: string) => group.members.find((m) => m.userId === userId)!;
  setCoHost(io, group, as('host'), 'co', true);
  return { io, group, as, told };
};

const answers = (told: ReturnType<typeof setup>['told'], userId: string) =>
  told.filter((t) => t.room === userId && t.event === 'room:rejoin-answer').map((t) => t.payload);

const removedBy = (io: Server, group: MusicGroup, by: string, target: string) =>
  removeFromRoom(
    io,
    group,
    group.members.find((m) => m.userId === by)!,
    target
  );

beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'], now: START }));
afterEach(() => {
  mock.timers.reset();
  musicGroups.clear();
  userGroups.clear();
});

test('only someone a host removed can ask', () => {
  const { io, group } = setup();
  assert.equal(askToRejoin(io, group, 'b'), 'not-removed');
  removedBy(io, group, 'host', 'b');
  assert.equal(askToRejoin(io, group, 'b'), null);
  assert.deepEqual(pendingRequestsOf(group), [
    { userId: 'b', userName: 'B', profilePic: undefined, askedAt: START, hostOnly: false },
  ]);
});

test('the hosts see the request in the room meta', () => {
  const { io, group, told } = setup();
  removedBy(io, group, 'host', 'b');
  askToRejoin(io, group, 'b');
  const meta = told.filter((t) => t.event === 'room:meta').at(-1)?.payload;
  assert.equal(meta?.rejoinRequests?.[0]?.userId, 'b');
});

test('letting someone in lifts the removal and tells them', () => {
  const { io, group, as, told } = setup();
  removedBy(io, group, 'host', 'b');
  askToRejoin(io, group, 'b');
  assert.equal(answerRejoin(io, group, as('co'), 'b', true), null);
  assert.ok(!group.removedIds.includes('b'));
  assert.deepEqual(pendingRequestsOf(group), []);
  assert.deepEqual(answers(told, 'b'), [{ groupId: GROUP, name: 'Friday', accepted: true }]);
});

test('declined twice, they cannot ask again; in between they wait', () => {
  const { io, group, as, told } = setup();
  removedBy(io, group, 'host', 'b');

  askToRejoin(io, group, 'b');
  answerRejoin(io, group, as('host'), 'b', false);
  assert.equal(askToRejoin(io, group, 'b'), 'too-soon');
  mock.timers.tick(ASK_COOLDOWN_MS);
  assert.equal(askToRejoin(io, group, 'b'), null);
  answerRejoin(io, group, as('host'), 'b', false);

  mock.timers.tick(ASK_COOLDOWN_MS);
  assert.equal(askToRejoin(io, group, 'b'), 'blocked');
  assert.ok(group.removedIds.includes('b'));
  assert.deepEqual(
    answers(told, 'b').map((a) => a.accepted),
    [false, false]
  );
});

test('asking twice while waiting is one request', () => {
  const { io, group } = setup();
  removedBy(io, group, 'host', 'b');
  assert.equal(askToRejoin(io, group, 'b'), null);
  assert.equal(askToRejoin(io, group, 'b'), null);
  assert.equal(pendingRequestsOf(group).length, 1);
});

test('a co-host cannot let back in someone removed while a co-host', () => {
  const { io, group, as } = setup();
  removedBy(io, group, 'host', 'co');
  setCoHost(io, group, as('host'), 'c', true);
  assert.equal(askToRejoin(io, group, 'co'), null);
  assert.equal(pendingRequestsOf(group)[0]?.hostOnly, true);
  assert.equal(answerRejoin(io, group, as('c'), 'co', true), 'not-allowed');
  assert.equal(answerRejoin(io, group, as('host'), 'co', true), null);
});

test('listeners cannot answer', () => {
  const { io, group, as } = setup();
  removedBy(io, group, 'host', 'b');
  askToRejoin(io, group, 'b');
  assert.equal(answerRejoin(io, group, as('c'), 'b', true), 'not-allowed');
});

test('nobody to answer: asking says so instead of waiting forever', () => {
  const { io, group, as } = setup();
  removedBy(io, group, 'host', 'b');
  as('host').connected = false;
  as('co').connected = false;
  assert.equal(askToRejoin(io, group, 'b'), 'no-hosts');
});
