import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { effects, type CallPeer } from './call.effects';
import {
  CallError,
  GONE_ACTIVE_MS,
  GONE_RINGING_MS,
  RING_MS,
  acceptCall,
  endCall,
  rejoinCall,
  relaySignal,
  resetCalls,
  socketGone,
  startCall,
} from './call.service';
import { withoutBlockedPorts } from './ice-servers';

const CAROL = { userId: 3, socketId: 'carol-tab' };

type Sent = { to: string | number; event: string; payload: any; except?: string };
let sent: Sent[];
let logs: Array<{
  callerId: number;
  calleeId: number;
  outcome: string;
  durationSec: number | null;
}>;
let pushes: number[];
let rings: boolean;
/** Each test gets its own people, so the per-person call limit never carries over. */
let nextUser = 100;

const person = (userId: number): CallPeer => ({
  userid: userId,
  name: `User ${userId}`,
  username: `user${userId}`,
  profilepic: null,
});

const events = (to: string | number, event: string) =>
  sent.filter((s) => s.to === to && s.event === event).map((s) => s.payload);

/** Lets the promise started by `ring` settle. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  // Before the clock is replaced: the last test's timers belong to the clock that made them.
  resetCalls();
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  resetCalls();
  sent = [];
  logs = [];
  pushes = [];
  rings = true;

  effects.emitToSocket = (to, event, payload) => void sent.push({ to, event, payload });
  effects.emitToUser = (to, event, payload, except) =>
    void sent.push({ to, event, payload, except });
  effects.ring = async () => rings;
  effects.canCall = async (a, b) => a !== CAROL.userId && b !== CAROL.userId;
  effects.profileOf = async (userId) => person(userId);
  effects.iceServers = async () => [{ urls: ['stun:example.org'] }];
  effects.pushIncoming = (calleeId) => void pushes.push(calleeId);
  effects.log = (callerId, calleeId, outcome, durationSec) =>
    void logs.push({ callerId, calleeId, outcome, durationSec });
  effects.secret = () => 'test-secret';
});

const pair = () => {
  const a = { userId: nextUser++, socketId: `a-${nextUser}` };
  const b = { userId: nextUser++, socketId: `b-${nextUser}` };
  return { a, b };
};

const answered = async () => {
  const { a, b } = pair();
  const { call } = await startCall(a, { to: b.userId });
  const { token } = await acceptCall(b, { callId: call.id });
  return { a, b, callId: call.id, token };
};

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => error instanceof CallError && error.code === code);

test('a call rings the other person and tells the caller once a device is ringing', async () => {
  const { a, b } = pair();
  const { call, iceServers } = await startCall(a, { to: b.userId });
  await settle();

  assert.equal(call.peer.userid, b.userId);
  assert.equal(iceServers.length, 1);
  assert.deepEqual(events(a.socketId, 'call:ringing'), [{ callId: call.id }]);
  assert.deepEqual(pushes, []);
});

test('when no device rings, the phone gets a push and the caller is not told it rings', async () => {
  rings = false;
  const { a, b } = pair();
  await startCall(a, { to: b.userId });
  await settle();

  assert.deepEqual(pushes, [b.userId]);
  assert.deepEqual(events(a.socketId, 'call:ringing'), []);
});

test('only people with a conversation can call each other, and never themselves', async () => {
  const { a } = pair();
  await rejects(startCall(a, { to: CAROL.userId }), 'FORBIDDEN');
  await rejects(startCall(a, { to: a.userId }), 'INVALID');
  await rejects(startCall(a, { to: 'nobody' }), 'INVALID');
});

test('answering starts the call on that one device and stops the others ringing', async () => {
  const { a, b, callId, token } = await answered();

  assert.deepEqual(events(a.socketId, 'call:accepted'), [{ callId, token }]);
  const stopped = sent.find((s) => s.to === b.userId && s.payload.reason === 'answered_elsewhere');
  assert.equal(stopped?.except, b.socketId);
  assert.deepEqual(logs, []);
});

test('signals reach only the other connection in the call', async () => {
  const { a, b, callId } = await answered();
  const otherTab = { userId: a.userId, socketId: 'another-tab' };

  relaySignal(a, { callId, data: { candidate: 'x' } });
  relaySignal(otherTab, { callId, data: { candidate: 'from a tab that is not in the call' } });
  relaySignal(CAROL, { callId, data: { candidate: 'from a stranger' } });

  assert.deepEqual(events(b.socketId, 'call:signal'), [{ callId, data: { candidate: 'x' } }]);
});

test('signals are not passed before the call is answered', async () => {
  const { a, b } = pair();
  const { call } = await startCall(a, { to: b.userId });
  relaySignal(a, { callId: call.id, data: { candidate: 'x' } });
  assert.equal(sent.filter((s) => s.event === 'call:signal').length, 0);
});

test('hanging up ends it for both and logs how long it lasted', async () => {
  const { a, b, callId } = await answered();
  mock.timers.tick(65_000);
  await endCall(b, { callId });

  assert.equal(events(a.userId, 'call:ended')[0].reason, 'ended');
  assert.equal(events(b.userId, 'call:ended').at(-1).reason, 'ended');
  assert.deepEqual(logs, [
    { callerId: a.userId, calleeId: b.userId, outcome: 'completed', durationSec: 65 },
  ]);
  await rejects(endCall(a, { callId }), 'GONE');
});

test('declining, cancelling and not answering are logged as what they were', async () => {
  let { a, b } = pair();
  let { call } = await startCall(a, { to: b.userId });
  await endCall(b, { callId: call.id });
  assert.equal(events(a.userId, 'call:ended')[0].reason, 'declined');

  ({ a, b } = pair());
  ({ call } = await startCall(a, { to: b.userId }));
  await endCall(a, { callId: call.id });
  assert.equal(events(b.userId, 'call:ended')[0].reason, 'cancelled');

  ({ a, b } = pair());
  ({ call } = await startCall(a, { to: b.userId }));
  mock.timers.tick(RING_MS);
  assert.equal(events(b.userId, 'call:ended')[0].reason, 'missed');
  await rejects(acceptCall(b, { callId: call.id }), 'GONE');

  assert.deepEqual(
    logs.map((log) => log.outcome),
    ['rejected', 'missed', 'missed']
  );
});

test('someone already in a call is busy, and sees the call they missed', async () => {
  const { a, b } = await answered();
  const c = { userId: nextUser++, socketId: 'c' };

  await rejects(startCall(c, { to: b.userId }), 'BUSY');
  await rejects(startCall(a, { to: c.userId }), 'BUSY');
  assert.deepEqual(logs, [
    { callerId: c.userId, calleeId: b.userId, outcome: 'missed', durationSec: null },
  ]);
});

test('only the person being called can answer', async () => {
  const { a, b } = pair();
  const { call } = await startCall(a, { to: b.userId });
  await rejects(acceptCall(a, { callId: call.id }), 'GONE');
  await rejects(acceptCall(CAROL, { callId: call.id }), 'GONE');
  await rejects(endCall(CAROL, { callId: call.id }), 'GONE');
});

test('a call survives a dropped connection that comes back', async () => {
  const { a, b, callId } = await answered();

  socketGone(a);
  assert.deepEqual(events(b.socketId, 'call:peer'), [{ callId, connected: false }]);
  mock.timers.tick(GONE_ACTIVE_MS - 1000);

  const back = { userId: a.userId, socketId: 'alice-new-connection' };
  const state = await rejoinCall(back, { callId });
  assert.equal(state.state, 'active');
  assert.equal(state.peerConnected, true);
  assert.deepEqual(events(b.socketId, 'call:peer').at(-1), { callId, connected: true });

  mock.timers.tick(GONE_ACTIVE_MS * 2);
  assert.deepEqual(logs, []);

  relaySignal(b, { callId, data: { candidate: 'y' } });
  assert.equal(events(back.socketId, 'call:signal').length, 1);
  // The old connection closing late must not take the new one's place away.
  socketGone(a);
  mock.timers.tick(GONE_ACTIVE_MS * 2);
  assert.deepEqual(logs, []);
});

test('a call ends when a connection stays away', async () => {
  const { a, b } = await answered();
  socketGone(b);
  mock.timers.tick(GONE_ACTIVE_MS);

  assert.equal(events(a.userId, 'call:ended')[0].reason, 'disconnected');
  assert.equal(logs[0]?.outcome, 'completed');
});

test('a caller who vanishes while ringing stops the ringing soon', async () => {
  const { a, b } = pair();
  await startCall(a, { to: b.userId });
  socketGone(a);
  mock.timers.tick(GONE_RINGING_MS);

  assert.equal(events(b.userId, 'call:ended')[0].reason, 'disconnected');
  assert.equal(logs[0]?.outcome, 'missed');
});

test('another tab of someone in a call closing does not touch the call', async () => {
  const { a, callId } = await answered();
  socketGone({ userId: a.userId, socketId: 'another-tab' });
  mock.timers.tick(GONE_ACTIVE_MS * 2);
  assert.deepEqual(logs, []);
  assert.equal((await rejoinCall(a, { callId })).state, 'active');
});

test('after a restart both sides pick an answered call up again with their token', async () => {
  const { a, b, callId, token } = await answered();
  mock.timers.tick(60_000);
  resetCalls(Date.now());
  sent = [];

  await rejects(rejoinCall(a, { callId }), 'GONE');
  await rejects(rejoinCall(a, { callId, token: `${token}x` }), 'GONE');
  await rejects(rejoinCall(CAROL, { callId, token }), 'GONE');

  const first = await rejoinCall(a, { callId, token });
  assert.deepEqual([first.state, first.peerConnected], ['active', false]);
  const second = await rejoinCall(b, { callId, token });
  assert.equal(second.peerConnected, true);

  relaySignal(a, { callId, data: { candidate: 'z' } });
  assert.equal(events(b.socketId, 'call:signal').length, 1);

  mock.timers.tick(30_000);
  await endCall(a, { callId });
  assert.deepEqual(logs, [
    { callerId: a.userId, calleeId: b.userId, outcome: 'completed', durationSec: 90 },
  ]);
});

test('a token cannot bring back a call that ended on this server', async () => {
  const { a, callId, token } = await answered();
  await endCall(a, { callId });
  await rejects(rejoinCall(a, { callId, token }), 'GONE');
});

test('a picked-up call ends if the other side never returns', async () => {
  const { a, b, callId, token } = await answered();
  resetCalls(Date.now() + 1);
  mock.timers.tick(10);
  sent = [];

  await rejoinCall(a, { callId, token });
  mock.timers.tick(GONE_ACTIVE_MS);
  assert.equal(events(a.userId, 'call:ended')[0].by, b.userId);
});

test('port 53 is dropped from the server list and 5349 is kept', () => {
  assert.deepEqual(
    withoutBlockedPorts([
      'stun:stun.cloudflare.com:53',
      'turn:turn.cloudflare.com:53?transport=udp',
      'turn:turn.cloudflare.com:3478?transport=udp',
      'turns:turn.cloudflare.com:5349?transport=tcp',
    ]),
    ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:5349?transport=tcp']
  );
});
