import http from 'node:http';
import { Server } from 'socket.io';
import app from '@/app';
import sequelize from '@/utils/sequelize';
import { socketManager } from '@/socket/index';
import { flushRooms, restoreRooms } from '@/socket/group-music';
import { startBackgroundRecalc } from '@/features/music/services/recommendation.service';
import { resumePendingUpdates } from '@/features/app-update/eas-webhook.controller';

const server = http.createServer(app);

const io = new Server(server, {
  // Spots a dead connection within 30s. The room's grace period covers any false alarm.
  pingTimeout: 20000,
  pingInterval: 10000,
  connectTimeout: 20000,
  maxHttpBufferSize: 2e6,
  transports: ['websocket', 'polling'],
  cors: {
    origin: [
      'https://syncvibe.thakur.dev',
      'http://localhost:5173',
      /^https:\/\/([a-z0-9-]+\.)*thakur\.dev$/,
    ],
    credentials: true,
  },
});

socketManager(io);

sequelize
  .authenticate()
  .then(async () => {
    // Before listening: a device that reconnected first would be told its room no longer exists.
    const restored = await restoreRooms(io);
    if (restored > 0) console.log(`Restored ${restored} music room(s)`);

    const port = process.env.PORT || 4000;
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      startBackgroundRecalc(60000);
      resumePendingUpdates().catch(console.error);
    });
  })
  .catch((err: Error) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // Rooms are saved a moment after each change; don't lose the last one.
  void flushRooms();
  server.close(async () => {
    await sequelize.close();
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
