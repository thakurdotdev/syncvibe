import { useUser } from '@/context/UserContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useMemo } from 'react';

/**
 * Your standing in the room. The host can make co-hosts and limit playback controls (play, pause,
 * seek, skip, rearranging) to the hosts; adding songs stays open to everyone, and anyone else can
 * vote to skip. The server enforces this, so these only decide what the screen offers.
 */
export const useRoomControl = () => {
  const { user } = useUser();
  const myId = user?.userid != null ? String(user.userid) : null;
  const hostId = useGroupSessionStore((s) => s.currentGroup?.createdBy);
  const coHosts = useGroupSessionStore((s) => s.currentGroup?.coHosts);
  const mutedIds = useGroupSessionStore((s) => s.currentGroup?.mutedIds);
  const skipVotes = useGroupSessionStore((s) => s.currentGroup?.skipVotes);
  const currentItemId = useGroupSessionStore((s) => s.currentItem?.id);
  const controlMode = useGroupSessionStore(
    (s) => s.currentGroup?.settings?.controlMode ?? 'everyone'
  );

  return useMemo(() => {
    const isHost = myId != null && hostId != null && String(hostId) === myId;
    const isCoHost = myId != null && Boolean(coHosts?.includes(myId));
    const canManage = isHost || isCoHost;
    const live = skipVotes?.itemId === currentItemId ? skipVotes : null;
    return {
      myId,
      hostId,
      coHosts: coHosts ?? [],
      mutedIds: mutedIds ?? [],
      /** The owner: changes the room's settings and makes co-hosts. */
      isHost,
      isCoHost,
      /** The host or a co-host. */
      canManage,
      isMuted: myId != null && Boolean(mutedIds?.includes(myId)),
      controlMode,
      canControl: controlMode !== 'host' || canManage,
      skipVote: {
        count: live?.userIds.length ?? 0,
        needed: live?.needed ?? null,
        voted: Boolean(myId && live?.userIds.includes(myId)),
      },
    };
  }, [myId, hostId, coHosts, mutedIds, skipVotes, currentItemId, controlMode]);
};
