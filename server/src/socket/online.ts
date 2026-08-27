import type { Server } from 'socket.io';
import type { AuthenticatedSocket, SocketContext } from './types';
import { getRedis } from '@/utils/redis';

export const setupOnlineHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  context: SocketContext
): void => {
  const { onlineUsers } = context;

  socket.on('user_online', async () => {
    if (!socket.userId) return;
    onlineUsers.add(socket.userId);

    try {
      const redis = getRedis();
      if (redis) {
        await redis.sadd('online_users', String(socket.userId));
      }
    } catch (err) {
      console.error('Redis online_users sadd error:', (err as Error).message);
    }

    io.emit('user_online', socket.userId);
  });

  socket.on('get_initial_online_users', () => {
    socket.emit('initial_online_users', Array.from(onlineUsers));
  });
};
