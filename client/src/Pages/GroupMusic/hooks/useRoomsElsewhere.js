import { useEffect, useMemo, useState } from 'react';
import { fetchMyRooms } from '@/stores/groupMusic/roomProtocol';

/**
 * Your rooms that are playing somewhere other than this tab. Asked for once, and again on every
 * reconnect; the server sends `room:mine` itself whenever one changes device, song or play state.
 */
export const useRoomsElsewhere = (socket, currentGroupId) => {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (!socket) return;
    let active = true;
    const load = () =>
      fetchMyRooms(socket).then((mine) => {
        if (active && mine) setRooms(mine);
      });
    const onRooms = (payload) => setRooms(Array.isArray(payload?.rooms) ? payload.rooms : []);

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
