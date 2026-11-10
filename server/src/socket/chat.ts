import type { AuthenticatedSocket } from './types';
import type { SocketIdentity } from './auth';
import { ChatError } from '@/features/chat/chat.errors';
import { asObject } from '@/features/chat/chat.validation';
import {
  announceTyping,
  deleteMessage,
  editMessage,
  markRead,
  sendMessage,
  setReaction,
} from '@/features/chat/services/message.service';

/**
 * What devices ask for. Every command is answered through its acknowledgement with
 * `{ ok: true, ... }` or `{ ok: false, code, message }`, and who is asking always comes from the
 * socket's session, never from the payload.
 *
 *   chat:send    { conversationId, clientId, body?, attachment?, replyToId? } → { message }
 *   chat:edit    { messageId, body }                                         → { message }
 *   chat:delete  { messageId }                                               → { conversationId, messageId }
 *   chat:react   { messageId, emoji | null }                                 → { message }
 *   chat:read    { conversationId, messageId }                               → { receipt }
 *   chat:typing  { conversationId, typing }                                  (no answer)
 *
 * What the server sends back to everyone is listed in features/chat/chat.realtime.
 */

type Command = (userId: number, payload: Record<string, unknown>) => Promise<object>;

const COMMANDS: Record<string, Command> = {
  'chat:send': async (userId, payload) => ({ message: await sendMessage(userId, payload) }),
  'chat:edit': async (userId, payload) => ({ message: await editMessage(userId, payload) }),
  'chat:delete': (userId, payload) => deleteMessage(userId, payload),
  'chat:react': async (userId, payload) => ({ message: await setReaction(userId, payload) }),
  'chat:read': async (userId, payload) => ({ receipt: await markRead(userId, payload) }),
};

export const setupChatHandlers = (socket: AuthenticatedSocket): void => {
  const identity = (): SocketIdentity | undefined => socket.data.identity;

  for (const [event, command] of Object.entries(COMMANDS)) {
    socket.on(event, async (payload: unknown, acknowledge: unknown) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const who = identity();
      if (!who) {
        reply({ ok: false, code: 'UNAUTHENTICATED', message: 'Sign in again to use messages' });
        return;
      }

      try {
        reply({ ok: true, ...(await command(who.userId, asObject(payload))) });
      } catch (error) {
        if (error instanceof ChatError) {
          reply({ ok: false, code: error.code, message: error.message });
          return;
        }
        console.error(`${event} failed:`, error);
        reply({ ok: false, code: 'INTERNAL', message: 'Something went wrong. Try again.' });
      }
    });
  }

  socket.on('chat:typing', (payload: unknown) => {
    const who = identity();
    if (!who) return;
    announceTyping(who.userId, asObject(payload)).catch((error) => {
      if (!(error instanceof ChatError)) console.error('chat:typing failed:', error);
    });
  });
};
