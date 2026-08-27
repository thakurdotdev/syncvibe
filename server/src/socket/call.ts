import type { Server } from 'socket.io';
import type { AuthenticatedSocket, SocketContext } from './types';
import { sendPushNotification } from './notification';
import { saveCallEvent } from '@/services/call-log.service';

const CALL_TIMEOUT = 30000;

interface CallLogParams {
  callerId: string | number;
  receiverId: string | number;
  messagetype: string;
  duration: number | null;
}

const emitCallLog = (
  io: Server,
  { callerId, receiverId, messagetype, duration }: CallLogParams
): void => {
  saveCallEvent({
    callerId: Number(callerId),
    receiverId: Number(receiverId),
    messagetype,
    duration,
  })
    .then((result) => {
      if (!result) return;
      io.to(String(callerId)).emit('call-log', result);
      io.to(String(receiverId)).emit('call-log', result);
    })
    .catch((err) => console.error('Call log save failed:', err));
};

export const cleanupCall = (
  userId: string | number,
  context: SocketContext
): string | number | null => {
  const { activeVideoCalls, callTimeouts } = context;
  const userKey = String(userId);
  if (!activeVideoCalls.has(userKey)) return null;

  const otherUser = activeVideoCalls.get(userKey)!;
  const otherKey = String(otherUser);
  activeVideoCalls.delete(userKey);
  activeVideoCalls.delete(otherKey);

  [userKey, otherKey].forEach((id) => {
    const timeout = callTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      callTimeouts.delete(id);
    }
  });

  return otherUser;
};

export const createCallHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  context: SocketContext
): void => {
  const { activeVideoCalls, callTimeouts, callStartTimes, userSockets, onlineUsers } = context;

  const emitError = (code: string, message?: string) => {
    socket.emit('call-error', {
      message: message || 'An error occurred during the call',
      code,
    });
  };

  const requireSetup = (): boolean => {
    if (!socket.userId) {
      emitError('NOT_AUTHENTICATED', 'Socket not authenticated');
      return false;
    }
    return true;
  };

  socket.on(
    'call-user',
    async (data: { to?: string | number; offer?: unknown; name?: string; profilepic?: string }) => {
      if (!requireSetup()) return;

      try {
        const { to, offer } = data;

        if (!to || !offer) {
          return emitError('INVALID_DATA', 'Missing required call data');
        }

        const senderKey = String(socket.userId);
        const recipientKey = String(to);

        if (activeVideoCalls.has(senderKey)) {
          return emitError('ALREADY_IN_CALL', 'You are already in a call');
        }

        const recipientSocket =
          userSockets.get(recipientKey) || userSockets.get(String(Number(to)));
        if (!recipientSocket) {
          return emitError('USER_OFFLINE', 'User is offline');
        }

        if (activeVideoCalls.has(recipientKey)) {
          return emitError('USER_BUSY', 'User is busy on another call');
        }

        activeVideoCalls.set(senderKey, to);
        activeVideoCalls.set(recipientKey, socket.userId!);

        const timeoutId = setTimeout(() => {
          if (activeVideoCalls.has(senderKey)) {
            cleanupCall(senderKey, context);
            emitError('CALL_TIMEOUT', 'Call not answered');
            io.to(recipientKey).emit('call-ended', {
              from: socket.userId,
              reason: 'timeout',
            });

            emitCallLog(io, {
              callerId: socket.userId!,
              receiverId: to,
              messagetype: 'missed_call',
              duration: null,
            });
          }
        }, CALL_TIMEOUT);

        callTimeouts.set(senderKey, timeoutId);

        socket.to(recipientKey).emit('incoming-call', {
          from: socket.userId,
          name: data.name,
          profilepic: data.profilepic,
          offer,
        });

        if (!onlineUsers.has(recipientKey) && !onlineUsers.has(String(Number(to)))) {
          sendPushNotification(to, { name: data.name, from: socket.userId }, 'call').catch(
            console.error
          );
        }
      } catch (error) {
        console.error('call-user error:', error);
        emitError('CALL_INITIATION_FAILED', (error as Error).message);
      }
    }
  );

  socket.on(
    'call-accepted',
    (data: { to?: string | number; answer?: unknown; name?: string; profilepic?: string }) => {
      if (!requireSetup()) return;

      try {
        const { to, answer } = data;

        if (!to || !answer) {
          return emitError('INVALID_DATA', 'Missing required answer data');
        }

        const senderKey = String(socket.userId);
        const recipientKey = String(to);

        if (
          !activeVideoCalls.has(senderKey) ||
          String(activeVideoCalls.get(senderKey)) !== recipientKey
        ) {
          return emitError('NO_ACTIVE_CALL', 'No active call to accept');
        }

        if (callTimeouts.has(recipientKey)) {
          clearTimeout(callTimeouts.get(recipientKey)!);
          callTimeouts.delete(recipientKey);
        }

        const callKey = [senderKey, recipientKey].sort().join('-');
        callStartTimes.set(callKey, Date.now());

        socket.to(recipientKey).emit('call-accepted', {
          from: socket.userId,
          name: data.name,
          profilepic: data.profilepic,
          answer,
        });
      } catch (error) {
        console.error('call-accepted error:', error);
        emitError('CALL_ACCEPT_FAILED', (error as Error).message);
      }
    }
  );

  socket.on('call-rejected', (data?: { reason?: string }) => {
    if (!requireSetup()) return;

    try {
      const otherUser = cleanupCall(socket.userId!, context);
      if (otherUser) {
        socket.to(String(otherUser)).emit('call-rejected', {
          from: socket.userId,
          reason: data?.reason,
        });

        emitCallLog(io, {
          callerId: otherUser,
          receiverId: socket.userId!,
          messagetype: 'rejected_call',
          duration: null,
        });
      }
    } catch (error) {
      console.error('call-rejected error:', error);
      emitError('CALL_REJECT_FAILED', (error as Error).message);
    }
  });

  socket.on('ice-candidate', (data: { candidate?: unknown }) => {
    if (!requireSetup()) return;

    try {
      const { candidate } = data;
      if (!candidate) return;

      const targetUser = activeVideoCalls.get(String(socket.userId));
      if (targetUser) {
        socket.to(String(targetUser)).emit('ice-candidate', {
          from: socket.userId,
          candidate,
        });
      }
    } catch (error) {
      console.error('ice-candidate error:', error);
    }
  });

  socket.on('ice-restart', (data: { offer?: unknown }) => {
    if (!requireSetup()) return;

    try {
      const { offer } = data;
      if (!offer) return;

      const targetUser = activeVideoCalls.get(String(socket.userId));
      if (!targetUser) return;

      socket.to(String(targetUser)).emit('ice-restart', {
        from: socket.userId,
        offer,
      });
    } catch (error) {
      console.error('ice-restart error:', error);
      emitError('ICE_RESTART_FAILED', (error as Error).message);
    }
  });

  socket.on('ice-restart-accept', (data: { answer?: unknown }) => {
    if (!requireSetup()) return;

    try {
      const { answer } = data;
      if (!answer) return;

      const targetUser = activeVideoCalls.get(String(socket.userId));
      if (!targetUser) return;

      socket.to(String(targetUser)).emit('ice-restart-accept', {
        from: socket.userId,
        answer,
      });
    } catch (error) {
      console.error('ice-restart-accept error:', error);
    }
  });

  socket.on('end-call', () => {
    if (!requireSetup()) return;

    try {
      const otherUser = activeVideoCalls.get(String(socket.userId));
      cleanupCall(socket.userId!, context);

      if (otherUser) {
        socket.to(String(otherUser)).emit('call-ended', {
          from: socket.userId,
          reason: 'ended',
        });

        const callKey = [String(socket.userId), String(otherUser)].sort().join('-');
        const startTime = callStartTimes.get(callKey);
        callStartTimes.delete(callKey);

        const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

        emitCallLog(io, {
          callerId: socket.userId!,
          receiverId: otherUser,
          messagetype: duration ? 'completed_call' : 'missed_call',
          duration,
        });
      }
    } catch (error) {
      console.error('end-call error:', error);
      emitError('END_CALL_FAILED', (error as Error).message);
    }
  });
};

export const handleCallDisconnect = (
  io: Server,
  userId: string | number,
  context: SocketContext
): string | number | null => {
  const { activeVideoCalls, callStartTimes } = context;
  const userKey = String(userId);
  const otherUser = activeVideoCalls.get(userKey);
  if (!otherUser) return null;

  cleanupCall(userId, context);

  const callKey = [userKey, String(otherUser)].sort().join('-');
  const startTime = callStartTimes.get(callKey);
  callStartTimes.delete(callKey);

  const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

  emitCallLog(io, {
    callerId: Number(userId),
    receiverId: Number(otherUser),
    messagetype: duration ? 'completed_call' : 'missed_call',
    duration,
  });

  return otherUser;
};
