import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatContext } from '@/Context/ChatContext';
import { Context } from '@/Context/Context';
import { authClient } from '@/lib/auth-client';
import { usePlayerStore } from '@/stores/playerStore';

/** Ends the session on the server, then clears everything the app holds for the user. */
export const useLogout = () => {
  const { setUser } = useContext(Context);
  const { cleanUpSocket } = useContext(ChatContext);
  const stopSong = usePlayerStore((s) => s.stopSong);
  const navigate = useNavigate();

  return useCallback(async () => {
    const { error } = await authClient.signOut();
    if (error) console.error('Sign-out request failed; clearing local session anyway:', error);

    cleanUpSocket();
    stopSong();
    setUser(null);
    navigate('/login', { replace: true });
  }, [cleanUpSocket, stopSong, setUser, navigate]);
};
