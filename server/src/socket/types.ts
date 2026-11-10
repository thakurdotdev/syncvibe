import type { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  musicHandlersSetup?: boolean;
}

export interface SocketContext {
  userSockets: Map<string, Socket>;
  activeVideoCalls: Map<string, string | number>;
  callTimeouts: Map<string, NodeJS.Timeout>;
  callStartTimes: Map<string, number>;
}
