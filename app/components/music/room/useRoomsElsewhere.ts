import { fetchMyRooms, type MyRoom } from '@/stores/groupMusic/roomProtocol';
import { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * Your rooms that are playing somewhere other than this phone. Asked for once, and again on every
 * reconnect; the server sends `room:mine` itself whenever one changes device, song or play state.
 */
export const useRoomsElsewhere = (
  socket: Socket | null | undefined,
  currentGroupId: string | undefined
): MyRoom[] => {
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

  return useMemo(
    () => rooms.filter((room) => room.groupId !== currentGroupId),
    [rooms, currentGroupId]
  );
};
