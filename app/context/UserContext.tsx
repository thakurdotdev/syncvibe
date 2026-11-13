import { User } from '@/types/user';
import useApi from '@/utils/hooks/useApi';
import { signOutGoogle } from '@/lib/googleAuth';
import { authClient, hasLegacyToken, hasStoredSession, removeLegacyToken } from '@/lib/auth-client';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';
import { markOnboardingComplete } from '@/lib/onboarding';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { bridgeStopSong } from '@/stores/trackPlayerBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';

interface UserContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  selectedLanguages: string;
  setSelectedLanguages: React.Dispatch<React.SetStateAction<string>>;
  /** Loads your profile. Resolves true once you're signed in with a profile, false otherwise. */
  getProfile: () => Promise<boolean>;
  loading: boolean;
  /**
   * The saved profile and language preference have been read from this phone. The fresh profile
   * may still be on its way, but nothing saved is left to pop in.
   */
  restored: boolean;
  musicConfig: Record<string, any>;
  setMusicConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [musicConfig, setMusicConfig] = useState<Record<string, any>>({});
  const [selectedLanguages, setSelectedLanguages] = useState<string>('hindi');

  /**
   * Shows the cached profile right away, then confirms the session with Better Auth (which also
   * refreshes the stored session cookie) and loads the fresh profile.
   */
  const loadProfile = async (isActive: () => boolean = () => true): Promise<boolean> => {
    if (await hasLegacyToken()) {
      // Sessions from before Better Auth are no longer accepted, so this user signs in again.
      await markOnboardingComplete();
      await AsyncStorage.removeItem('@user_profile');
      await removeLegacyToken();
    }

    if (!(await hasStoredSession())) return false;

    const cachedProfile = await AsyncStorage.getItem('@user_profile');
    if (isActive()) {
      if (cachedProfile) {
        setUser(JSON.parse(cachedProfile));
        setLoading(false);
      }
      setRestored(true);
    }

    const { data: session, error } = await authClient.getSession();
    if (!session && !error) {
      await AsyncStorage.removeItem('@user_profile');
      if (isActive()) setUser(null);
      return false;
    }

    const response = await api.get('/api/profile');
    if (response.status === 200 && isActive()) {
      const freshUser = response.data.user;
      setUser(freshUser);
      await AsyncStorage.setItem('@user_profile', JSON.stringify(freshUser));
      return true;
    }
    return Boolean(cachedProfile);
  };

  const handleProfileError = async (error: any) => {
    console.error('Error fetching profile:', error);
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('@user_profile');
      setUser(null);
    }
  };

  const getProfile = async () => {
    try {
      return await loadProfile();
    } catch (error: any) {
      await handleProfileError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const isActive = () => isMounted;

    const bootstrap = async () => {
      try {
        const langPref = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (langPref && isMounted) {
          setSelectedLanguages(langPref);
        }

        await loadProfile(isActive);
      } catch (error: any) {
        if (isMounted) await handleProfileError(error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setRestored(true);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [api]);

  const logout = async () => {
    queryClient.cancelQueries();
    queryClient.clear();
    // What's in memory belongs to the account that's leaving: its room, queue and playlists
    // (playlists are also saved on the phone, so the next person mustn't see them). The socket,
    // messages and presence go when `user` does (ChatProvider). Stopping is local only: your
    // music on another device keeps playing.
    useGroupSessionStore.getState().resetSession(() => useGroupPlaybackStore.getState().reset());
    void bridgeStopSong();
    usePlayerStore.setState({
      currentSong: null,
      playlist: [],
      originalPlaylist: [],
      isPlaying: false,
      isLoading: false,
      userPlaylist: [],
    });
    // Logging out clears everything except the fact that this device has seen onboarding.
    // The Expo auth client removes the stored session cookie before the request is sent.
    await Promise.allSettled([
      authClient.signOut(),
      AsyncStorage.clear().then(markOnboardingComplete),
      signOutGoogle(),
    ]);
    setUser(null);
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await api.post('/api/update-profile', userData);
      if (response.status === 200) {
        const updated = response.data.user;
        setUser(updated);
        await AsyncStorage.setItem('@user_profile', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        getProfile,
        loading,
        restored,
        musicConfig,
        setMusicConfig,
        logout,
        selectedLanguages,
        setSelectedLanguages,
        updateUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
