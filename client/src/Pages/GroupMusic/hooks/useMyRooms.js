import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMyRooms, forgetMyRoom } from '@/stores/groupMusic/roomProtocol';

/**
 * Your rooms as this tab should offer them: ones playing on another device, and ones you left
 * lately. Asked for once, and again on every reconnect; the server sends `room:mine` itself
 * whenever one changes.
 */
export const useMyRooms = (socket, currentGroupId) => {
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

  const dismiss = useCallback(
    (groupId) => {
      setRooms((list) => list.filter((room) => room.groupId !== groupId));
      forgetMyRoom(socket, groupId);
    },
    [socket]
  );

  const offered = useMemo(
    () => rooms.filter((room) => room.groupId !== currentGroupId),
    [rooms, currentGroupId]
  );

  return { rooms: offered, dismiss };
};
