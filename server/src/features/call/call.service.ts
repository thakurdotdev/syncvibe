import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRateLimiter } from '@/utils/rate-limiter';
import { effects, type CallPeer } from './call.effects';
import type { IceServer } from './ice-servers';

/**
 * One-to-one video calls. The server owns the call: who is in it, whether it is ringing or
 * answered, and when it is over. The two browsers send their video straight to each other
 * (WebRTC); the server only passes their connection messages between the two connections that
 * are in the call, and never to a person's other tabs or devices.
 *
 * Calls live in memory, like the socket connections they belong to.
 */

export type CallErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID'
  | 'FORBIDDEN'
  | 'BUSY'
  | 'GONE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** An error whose message is safe to show to the person who caused it. */
export class CallError extends Error {
  readonly code: CallErrorCode;

  constructor(code: CallErrorCode, message: string) {
    super(message);
    this.name = 'CallError';
    this.code = code;
  }
}

export type CallEndReason =
  | 'ended'
  | 'declined'
  | 'cancelled'
  | 'missed'
  | 'disconnected'
  // Only to the callee's other devices: stop ringing, the call itself goes on.
  | 'answered_elsewhere';

/** Who is asking: always taken from the socket's session, never from what it sends. */
export interface Caller {
  userId: number;
  socketId: string;
}

interface Party {
  userId: number;
  /** The one connection in the call. Null while ringing (callee) or while it is reconnecting. */
  socketId: string | null;
  gone?: NodeJS.Timeout;
}

interface Call {
  id: string;
  caller: Party;
  callee: Party;
  state: 'ringing' | 'active';
  answeredAt: number | null;
  ringTimer?: NodeJS.Timeout;
}

/** How long a call rings before it counts as missed. */
export const RING_MS = 40_000;
/**
 * A connection that drops usually comes straight back, and the video doesn't pass through the
 * server anyway, so a call outlives its connection by this long.
 */
export const GONE_RINGING_MS = 10_000;
export const GONE_ACTIVE_MS = 30_000;
/** After a restart, calls that were going on may be picked up again for this long. */
const REVIVE_WINDOW_MS = 3 * 60_000;
const CALL_ID = /^[0-9a-f-]{36}$/;

const calls = new Map<string, Call>();
const callOfUser = new Map<number, string>();
let bootedAt = Date.now();

const allowStart = createRateLimiter({ limit: 6, windowMs: 60_000 });

const gone = () => new CallError('GONE', 'This call has ended');

const partyOf = (call: Call, userId: number): Party | null =>
  call.caller.userId === userId ? call.caller : call.callee.userId === userId ? call.callee : null;

const otherOf = (call: Call, party: Party): Party =>
  party === call.caller ? call.callee : call.caller;

/** The call with this id, if `userId` is one of its two people. */
const callFor = (callId: unknown, userId: number): { call: Call; mine: Party } => {
  const call = typeof callId === 'string' ? calls.get(callId) : undefined;
  const mine = call && partyOf(call, userId);
  if (!call || !mine) throw gone();
  return { call, mine };
};

const finish = (call: Call, reason: CallEndReason, by?: number): void => {
  if (calls.get(call.id) !== call) return;
  calls.delete(call.id);
  for (const party of [call.caller, call.callee]) {
    if (callOfUser.get(party.userId) === call.id) callOfUser.delete(party.userId);
    clearTimeout(party.gone);
  }
  clearTimeout(call.ringTimer);

  // To every device of both people: the ones still ringing, and any that is reconnecting.
  const payload = { callId: call.id, reason, by: by ?? null };
  effects.emitToUser(call.caller.userId, 'call:ended', payload);
  effects.emitToUser(call.callee.userId, 'call:ended', payload);

  if (call.answeredAt) {
    const seconds = Math.max(1, Math.round((Date.now() - call.answeredAt) / 1000));
    effects.log(call.caller.userId, call.callee.userId, 'completed', seconds);
  } else {
    const outcome = reason === 'declined' ? 'rejected' : 'missed';
    effects.log(call.caller.userId, call.callee.userId, outcome, null);
  }
};

// ── Picking a call up again after a restart ─────────────────────────────────

const mac = (body: string): string =>
  createHmac('sha256', effects.secret()).update(`call:${body}`).digest('base64url');

/** Proof of an answered call, held by its two browsers. */
const tokenOf = (call: Call): string => {
  const body = Buffer.from(
    JSON.stringify([call.id, call.caller.userId, call.callee.userId, call.answeredAt])
  ).toString('base64url');
  return `${body}.${mac(body)}`;
};

/**
 * A deploy restarts the server and forgets every call, while the two browsers go on sending each
 * other video. When they reconnect they show the token they were given, and the call is put back.
 * Only for calls answered before this process started, and only shortly after it did, so a token
 * can't bring back a call that has ended.
 */
const revive = (token: unknown, userId: number): Call | null => {
  if (typeof token !== 'string' || !effects.secret()) return null;
  if (Date.now() - bootedAt > REVIVE_WINDOW_MS) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let fields: unknown;
  try {
    fields = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
  if (!Array.isArray(fields)) return null;
  const [id, callerId, calleeId, answeredAt] = fields as [string, number, number, number];
  if (answeredAt >= bootedAt || (userId !== callerId && userId !== calleeId)) return null;
  if (calls.has(id) || callOfUser.has(callerId) || callOfUser.has(calleeId)) return null;

  const call: Call = {
    id,
    caller: { userId: callerId, socketId: null },
    callee: { userId: calleeId, socketId: null },
    state: 'active',
    answeredAt,
  };
  calls.set(id, call);
  // Whoever doesn't come back within the usual time ends it, as if they had just dropped.
  for (const party of [call.caller, call.callee]) {
    callOfUser.set(party.userId, id);
    party.gone = setTimeout(() => finish(call, 'disconnected', party.userId), GONE_ACTIVE_MS);
  }
  return call;
};

// ── Commands ────────────────────────────────────────────────────────────────

export const startCall = async (
  who: Caller,
  payload: Record<string, unknown>
): Promise<{ call: { id: string; peer: CallPeer }; iceServers: IceServer[] }> => {
  const calleeId = typeof payload.to === 'string' ? Number(payload.to) : payload.to;
  if (typeof calleeId !== 'number' || !Number.isSafeInteger(calleeId) || calleeId <= 0) {
    throw new CallError('INVALID', 'Invalid person to call');
  }
  if (calleeId === who.userId) throw new CallError('INVALID', "You can't call yourself");
  if (callOfUser.has(who.userId)) throw new CallError('BUSY', "You're already in a call");
  if (!allowStart(who.userId)) {
    throw new CallError('RATE_LIMITED', "You're calling too often. Wait a moment.");
  }

  const [caller, callee, allowed, iceServers] = await Promise.all([
    effects.profileOf(who.userId),
    effects.profileOf(calleeId),
    effects.canCall(who.userId, calleeId),
    effects.iceServers(),
  ]);
  if (!caller || !callee || !allowed) {
    throw new CallError('FORBIDDEN', 'You can only call people you have a conversation with');
  }

  // Checked again, and from here to the end nothing waits: two calls can't both get through.
  if (callOfUser.has(who.userId)) throw new CallError('BUSY', "You're already in a call");
  if (callOfUser.has(calleeId)) {
    effects.log(who.userId, calleeId, 'missed', null);
    throw new CallError('BUSY', `${callee.name} is on another call`);
  }

  const call: Call = {
    id: randomUUID(),
    caller: { userId: who.userId, socketId: who.socketId },
    callee: { userId: calleeId, socketId: null },
    state: 'ringing',
    answeredAt: null,
  };
  calls.set(call.id, call);
  callOfUser.set(who.userId, call.id);
  callOfUser.set(calleeId, call.id);
  call.ringTimer = setTimeout(() => finish(call, 'missed'), RING_MS);

  effects
    .ring(calleeId, { call: { id: call.id, peer: caller } })
    .then((rang) => {
      if (calls.get(call.id) !== call || call.state !== 'ringing') return;
      if (!rang) effects.pushIncoming(calleeId, caller);
      else if (call.caller.socketId) {
        effects.emitToSocket(call.caller.socketId, 'call:ringing', { callId: call.id });
      }
    })
    .catch((error) => console.error('Ringing failed:', error));

  return { call: { id: call.id, peer: callee }, iceServers };
};

export const acceptCall = async (
  who: Caller,
  payload: Record<string, unknown>
): Promise<{ token: string; iceServers: IceServer[] }> => {
  const iceServers = await effects.iceServers();

  const { call, mine } = callFor(payload.callId, who.userId);
  if (call.state !== 'ringing' || mine !== call.callee) throw gone();

  clearTimeout(call.ringTimer);
  call.state = 'active';
  call.answeredAt = Date.now();
  mine.socketId = who.socketId;

  const token = tokenOf(call);
  if (call.caller.socketId) {
    effects.emitToSocket(call.caller.socketId, 'call:accepted', { callId: call.id, token });
  }
  effects.emitToUser(
    mine.userId,
    'call:ended',
    { callId: call.id, reason: 'answered_elsewhere', by: mine.userId },
    who.socketId
  );
  return { token, iceServers };
};

/** Hanging up, and also declining a call or giving up on one that is still ringing. */
export const endCall = async (who: Caller, payload: Record<string, unknown>): Promise<object> => {
  const { call, mine } = callFor(payload.callId, who.userId);
  const reason =
    call.state === 'active' ? 'ended' : mine === call.caller ? 'cancelled' : 'declined';
  finish(call, reason, who.userId);
  return {};
};

/**
 * After this connection was replaced by a new one (network change, sleep, a server restart): the
 * new one takes its place in the call.
 */
export const rejoinCall = async (
  who: Caller,
  payload: Record<string, unknown>
): Promise<{ state: Call['state']; token: string | null; peerConnected: boolean }> => {
  const callId = payload.callId;
  if (typeof callId !== 'string' || !CALL_ID.test(callId)) throw gone();

  const call = calls.get(callId) ?? revive(payload.token, who.userId);
  const mine = call && call.id === callId ? partyOf(call, who.userId) : null;
  if (!call || !mine) throw gone();

  const peer = otherOf(call, mine);
  // A device that was only ringing holds no place in the call yet.
  if (call.state === 'active' || mine === call.caller) {
    clearTimeout(mine.gone);
    mine.gone = undefined;
    mine.socketId = who.socketId;
    if (peer.socketId) {
      effects.emitToSocket(peer.socketId, 'call:peer', { callId: call.id, connected: true });
    }
  }
  return {
    state: call.state,
    token: call.state === 'active' ? tokenOf(call) : null,
    peerConnected: Boolean(peer.socketId),
  };
};

/**
 * Passes one browser's connection message (offer, answer, network candidate, camera or
 * microphone state) to the other. The server doesn't read it.
 */
export const relaySignal = (who: Caller, payload: Record<string, unknown>): void => {
  const call = typeof payload.callId === 'string' ? calls.get(payload.callId) : undefined;
  if (!call || call.state !== 'active') return;
  const mine = partyOf(call, who.userId);
  if (!mine || mine.socketId !== who.socketId) return;
  const data = payload.data;
  if (!data || typeof data !== 'object') return;

  const peer = otherOf(call, mine);
  if (peer.socketId) effects.emitToSocket(peer.socketId, 'call:signal', { callId: call.id, data });
};

/** A connection closed. If it was in a call, the call waits a little for it to come back. */
export const socketGone = (who: Caller): void => {
  const callId = callOfUser.get(who.userId);
  const call = callId ? calls.get(callId) : undefined;
  const mine = call && partyOf(call, who.userId);
  if (!call || !mine || mine.socketId !== who.socketId) return;

  mine.socketId = null;
  mine.gone = setTimeout(
    () => finish(call, 'disconnected', who.userId),
    call.state === 'active' ? GONE_ACTIVE_MS : GONE_RINGING_MS
  );
  const peer = otherOf(call, mine);
  if (peer.socketId) {
    effects.emitToSocket(peer.socketId, 'call:peer', { callId: call.id, connected: false });
  }
};

/** For tests: forget every call, and optionally pretend the server started at another time. */
export const resetCalls = (startedAt = Date.now()): void => {
  for (const call of calls.values()) {
    clearTimeout(call.ringTimer);
    clearTimeout(call.caller.gone);
    clearTimeout(call.callee.gone);
  }
  calls.clear();
  callOfUser.clear();
  bootedAt = startedAt;
};
