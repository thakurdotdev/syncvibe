import type { AuthenticatedSocket } from './types';
import type { SocketIdentity } from './auth';
import { asObject } from '@/features/chat/chat.validation';
import '@/features/call/call.effects.live';
import {
  CallError,
  acceptCall,
  endCall,
  rejoinCall,
  relaySignal,
  socketGone,
  startCall,
  type Caller,
} from '@/features/call/call.service';

/**
 * Video calls between two people (web only; the phone app doesn't take calls yet).
 *
 * What a device asks for. Every command is answered through its acknowledgement with
 * `{ ok: true, ... }` or `{ ok: false, code, message }`, and who is asking always comes from the
 * socket's session.
 *
 *   call:start   { to }                → { call: { id, peer }, iceServers }
 *   call:accept  { callId }            → { token, iceServers }
 *   call:end     { callId }            → {}          hang up, decline, or cancel while ringing
 *   call:rejoin  { callId, token? }    → { state, token, peerConnected }   after reconnecting
 *   call:signal  { callId, data }      (no answer)   passed as it is to the other browser
 *
 * What the server sends:
 *
 *   call:incoming  { call: { id, peer } }    to all of the callee's devices; one that rings confirms
 *   call:ringing   { callId }                to the caller: a device of the callee is ringing
 *   call:accepted  { callId, token }         to the caller: start connecting
 *   call:signal    { callId, data }          from the other browser
 *   call:peer      { callId, connected }     the other side lost or regained its connection
 *   call:ended     { callId, reason, by }    ended | declined | cancelled | missed | disconnected |
 *                                            answered_elsewhere (only to the callee's other devices)
 *
 * Once answered, a call belongs to one connection on each side: signals go there and nowhere
 * else. The rules are in features/call/call.service.
 */

type Command = (who: Caller, payload: Record<string, unknown>) => Promise<object>;

const COMMANDS: Record<string, Command> = {
  'call:start': startCall,
  'call:accept': acceptCall,
  'call:end': endCall,
  'call:rejoin': rejoinCall,
};

export const setupCallHandlers = (socket: AuthenticatedSocket): void => {
  const who = (): Caller | null => {
    const identity: SocketIdentity | undefined = socket.data.identity;
    return identity ? { userId: identity.userId, socketId: socket.id } : null;
  };

  for (const [event, command] of Object.entries(COMMANDS)) {
    socket.on(event, async (payload: unknown, acknowledge: unknown) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const caller = who();
      if (!caller) {
        reply({ ok: false, code: 'UNAUTHENTICATED', message: 'Sign in again to make calls' });
        return;
      }

      try {
        reply({ ok: true, ...(await command(caller, asObject(payload))) });
      } catch (error) {
        if (error instanceof CallError) {
          reply({ ok: false, code: error.code, message: error.message });
          return;
        }
        console.error(`${event} failed:`, error);
        reply({ ok: false, code: 'INTERNAL', message: 'Something went wrong. Try again.' });
      }
    });
  }

  socket.on('call:signal', (payload: unknown) => {
    const caller = who();
    if (caller) relaySignal(caller, asObject(payload));
  });

  socket.on('disconnect', () => {
    const caller = who();
    if (caller) socketGone(caller);
  });

  // A tab that was open before calls changed still speaks the old way. It can't be connected,
  // so it is told at once instead of ringing nobody until it gives up.
  socket.on('call-user', () => {
    socket.emit('call-error', {
      code: 'USER_OFFLINE',
      message: 'Refresh the page to make calls',
    });
  });
};
