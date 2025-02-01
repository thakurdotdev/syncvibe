import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { useContext } from "react";
import { useMemo } from "react";

export const Context = createContext();

export const useProfile = () => useContext(Context);

export const ContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [musicConfig, setMusicConfig] = useState({});

  useEffect(() => {
    if (user) return;
    getProfile();
  }, [user]);

  useEffect(() => {
    const dataFromStorage = localStorage.getItem("musicConfig");
    if (dataFromStorage) {
      setMusicConfig(JSON.parse(dataFromStorage));
    }
  }, []);

  const getProfile = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/profile`,
        {
          withCredentials: true,
        },
      );
      if (response.status === 200) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Error fetching profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const memoizedValue = useMemo(
    () => ({
      user,
      setUser,
      getProfile,
      loading,
      musicConfig,
      setMusicConfig,
    }),
    [user, loading, musicConfig],
  );

  return <Context.Provider value={memoizedValue}>{children}</Context.Provider>;
};
