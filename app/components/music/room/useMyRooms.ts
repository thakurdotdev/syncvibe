import { toast } from '@/context/ToastContext';
import {
  askToRejoin,
  fetchMyRooms,
  forgetMyRoom,
  type MyRoom,
} from '@/stores/groupMusic/roomProtocol';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * Your rooms as this phone should offer them: ones playing on another device, ones you left
 * lately, and ones a host removed you from. Asked for once, and again on every reconnect; the server sends `room:mine` itself
 * whenever one changes.
 */
export const useMyRooms = (
  socket: Socket | null | undefined,
  currentGroupId: string | undefined
): {
  rooms: MyRoom[];
  ask: (groupId: string) => Promise<void>;
  dismiss: (groupId: string) => void;
} => {
  const [rooms, setRooms] = useState<MyRoom[]>([]);

  useEffect(() => {
    if (!socket) return;
    let active = true;
    const load = () =>
      fetchMyRooms(socket).then((mine) => {
        if (active && mine) setRooms(mine);
      });
    const onRooms = (payload?: { rooms?: MyRoom[] }) =>
      setRooms(Array.isArray(payload?.rooms) ? payload.rooms : []);

    socket.on('room:mine', onRooms);
    socket.on('connect', load);
    load();
    return () => {
      active = false;
      socket.off('room:mine', onRooms);
      socket.off('connect', load);
    };
  }, [socket]);

  const dismiss = useCallback(
    (groupId: string) => {
      setRooms((list) => list.filter((room) => room.groupId !== groupId));
      forgetMyRoom(socket, groupId);
    },
    [socket]
  );

  /** Asks a room's hosts to let you back in. The new state comes back as `room:mine`. */
  const ask = useCallback(
    async (groupId: string) => {
      const result = await askToRejoin(socket, groupId);
      if (result.ok) toast('Asked the hosts to let you back in', { type: 'success' });
      else toast(result.error ?? 'Could not ask. Try again.', { type: 'error' });
    },
    [socket]
  );

  const offered = useMemo(
    () => rooms.filter((room) => room.groupId !== currentGroupId),
    [rooms, currentGroupId]
  );

  return { rooms: offered, ask, dismiss };
};
