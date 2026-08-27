import type { Server } from 'socket.io';

let ioInstance: Server | null = null;
let userSocketsMap: Map<string, unknown> | null = null;

export const setSocketIO = (io: Server, userSockets: Map<string, unknown>): void => {
  ioInstance = io;
  userSocketsMap = userSockets;
};

export const emitToUser = (userid: string | number, event: string, data: unknown): boolean => {
  if (!ioInstance) return false;

  ioInstance.to(String(userid)).emit(event, data);
  return true;
};

export const getIO = (): Server | null => ioInstance;
export const getUserSockets = (): Map<string, unknown> | null => userSocketsMap;
