import type { IceServer } from './ice-servers';

export interface CallPeer {
  userid: number;
  name: string;
  username: string;
  profilepic: string | null;
}

export type CallLogOutcome = 'missed' | 'completed' | 'rejected';

/**
 * What calls need from the rest of the server: sockets, the database, push. Kept apart so the
 * rules in `call.service` can be tested without any of them; the real ones are set in
 * `call.effects.live.ts`.
 */
export const effects = {
  /** To one connection: the device that is in the call. */
  emitToSocket: (_socketId: string, _event: string, _payload: unknown): void => {},
  /** To all of a person's signed-in devices, except one connection if given. */
  emitToUser: (_userId: number, _event: string, _payload: unknown, _except?: string): void => {},
  /** Rings every device of a person; resolves to whether any of them confirmed it is ringing. */
  ring: async (_userId: number, _payload: unknown): Promise<boolean> => false,
  /** Whether the two people have a conversation: calls start from one. */
  canCall: async (_callerId: number, _calleeId: number): Promise<boolean> => false,
  profileOf: async (_userId: number): Promise<CallPeer | null> => null,
  iceServers: async (): Promise<IceServer[]> => [],
  /** No device rang: the phone gets a notification instead. */
  pushIncoming: (_calleeId: number, _caller: CallPeer): void => {},
  /** The call's line in the two people's conversation. */
  log: (
    _callerId: number,
    _calleeId: number,
    _outcome: CallLogOutcome,
    _durationSec: number | null
  ): void => {},
  secret: (): string => '',
};
