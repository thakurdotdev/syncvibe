import { User } from '@/models/index';
import { getIO } from '@/utils/socket-emitter';
import { userRoom } from '@/features/chat/chat.realtime';
import { findDirectConversationId } from '@/features/chat/services/conversation.service';
import { recordCall } from '@/features/chat/services/message.service';
import { sendPushNotification } from '@/socket/notification';
import { effects } from './call.effects';
import { getIceServers } from './ice-servers';

/** How long a device has to say it is ringing before the phone gets a push instead. */
const RING_ACK_MS = 4000;

effects.emitToSocket = (socketId, event, payload) => {
  getIO()?.to(socketId).emit(event, payload);
};

effects.emitToUser = (userId, event, payload, except) => {
  const room = getIO()?.to(userRoom(userId));
  (except ? room?.except(except) : room)?.emit(event, payload);
};

effects.ring = (userId, payload) =>
  new Promise((resolve) => {
    const io = getIO();
    if (!io || !io.sockets.adapter.rooms.get(userRoom(userId))?.size) {
      resolve(false);
      return;
    }
    io.to(userRoom(userId))
      .timeout(RING_ACK_MS)
      // The phone app is in this room too and doesn't take calls: only a device that can ring
      // confirms. On a timeout the confirmations that did arrive still come with the error.
      .emit('call:incoming', payload, (_error: Error | null, confirmations?: unknown[]) => {
        resolve(Boolean(confirmations?.length));
      });
  });

effects.canCall = async (callerId, calleeId) =>
  (await findDirectConversationId(callerId, calleeId)) !== null;

effects.profileOf = async (userId) => {
  const user = await User.findOne({
    where: { userid: userId, isDeleted: false },
    attributes: ['userid', 'name', 'username', 'profilepic'],
  });
  return user
    ? {
        userid: user.userid,
        name: user.name,
        username: user.username,
        profilepic: user.profilepic,
      }
    : null;
};

effects.iceServers = getIceServers;

effects.pushIncoming = (calleeId, caller) => {
  sendPushNotification(calleeId, { name: caller.name, from: caller.userid }, 'call').catch(
    (error) => console.error('Call push failed:', error)
  );
};

effects.log = (callerId, calleeId, outcome, durationSec) => {
  recordCall(callerId, calleeId, {
    outcome,
    ...(durationSec ? { durationSec } : {}),
  }).catch((error) => console.error('Call log save failed:', error));
};

effects.secret = () => process.env.BETTER_AUTH_SECRET;
