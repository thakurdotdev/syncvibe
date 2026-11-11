import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/Context/ChatContext';
import { useProfile } from '@/Context/Context';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';

const NO_REQUESTS = [];
const toastIdOf = (groupId, userId) => `rejoin-${groupId}-${userId}`;

/**
 * Requests to be let back into the room, for whoever can answer them: the host, and co-hosts for
 * anyone removed as a listener. Each is a toast that stays up, on any page, until someone answers
 * it here or on another host's device.
 */
const RejoinRequests = () => {
  const { socket } = useSocket();
  const { user } = useProfile();
  const group = useGroupSessionStore((s) => s.currentGroup);
  const shown = useRef(new Set());

  const myId = user?.userid != null ? String(user.userid) : null;
  const isHost = myId != null && String(group?.createdBy) === myId;
  const canManage = isHost || Boolean(myId && group?.coHosts?.includes(myId));
  const allRequests = group?.rejoinRequests ?? NO_REQUESTS;

  const requests = useMemo(
    () => (canManage ? allRequests.filter((request) => isHost || !request.hostOnly) : NO_REQUESTS),
    [allRequests, canManage, isHost]
  );

  useEffect(() => {
    const groupId = group?.id;
    const wanted = new Set(requests.map((request) => toastIdOf(groupId, request.userId)));
    for (const id of shown.current) {
      if (wanted.has(id)) continue;
      toast.dismiss(id);
      shown.current.delete(id);
    }

    for (const request of requests) {
      const id = toastIdOf(groupId, request.userId);
      if (shown.current.has(id)) continue;
      shown.current.add(id);
      const answer = (accept) =>
        useGroupSessionStore.getState().answerRejoin(socket, request.userId, accept);
      toast(`${request.userName} wants to rejoin`, {
        id,
        duration: Infinity,
        description: `A host removed them from ${group?.name || 'the room'}.`,
        action: { label: 'Let in', onClick: () => answer(true) },
        cancel: { label: 'Decline', onClick: () => answer(false) },
      });
    }
  }, [requests, group?.id, group?.name, socket]);

  useEffect(() => {
    const ids = shown.current;
    return () => ids.forEach((id) => toast.dismiss(id));
  }, []);

  return null;
};

export default RejoinRequests;
