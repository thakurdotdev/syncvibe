import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/Context/Context';
import { paths } from '@/lib/paths';
import { openStartRoom } from '@/lib/roomSeed';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * "Start a room with this" in the player: the create form on Rooms with your music on. Null
 * while you're in a room or nothing is on.
 */
export const useStartRoom = () => {
  const navigate = useNavigate();
  const { user } = useProfile();
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong?.id));
  const start = useCallback(() => {
    useUiStore.getState().setPlayerSheetOpen(false);
    openStartRoom(user?.name);
    navigate(paths.rooms);
  }, [navigate, user?.name]);
  return inRoom || !hasSong ? null : start;
};
