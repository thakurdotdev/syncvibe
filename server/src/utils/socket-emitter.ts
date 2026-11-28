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

/** Cuts the live connections of a sign-in that has just been revoked. */
export const disconnectSession = (sessionId: string): void => {
  ioInstance?.in(`session:${sessionId}`).disconnectSockets(true);
};

/**
 * Rooms show people by the name and picture their connection holds, read when it connected, so a
 * change to either is passed on to the connections already open.
 */
export const updateSocketProfile = (
  userid: number,
  profile: { name?: string; picture?: string | null }
): void => {
  for (const id of ioInstance?.sockets.adapter.rooms.get(String(userid)) ?? []) {
    const identity = ioInstance?.sockets.sockets.get(id)?.data.identity;
    if (identity) Object.assign(identity, profile);
  }
};
