import { useUser } from '@/context/UserContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { sameUser } from './chat/chatUtils';

/**
 * Your standing in the room. The host can limit playback controls (play, pause, seek, skip,
 * rearranging) to themselves; adding songs stays open to everyone. The server enforces this, so
 * these only decide what the screen offers.
 */
export const useRoomControl = () => {
  const { user } = useUser();
  const hostId = useGroupSessionStore((s) => s.currentGroup?.createdBy);
  const controlMode = useGroupSessionStore(
    (s) => s.currentGroup?.settings?.controlMode ?? 'everyone'
  );
  const isHost = sameUser(hostId, user?.userid);
  return { isHost, controlMode, canControl: controlMode !== 'host' || isHost };
};
