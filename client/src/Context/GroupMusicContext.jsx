import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { useSocket } from "@/Context/ChatContext";
import { useProfile } from "@/Context/Context";
import axios from "axios";
import _ from "lodash";
import { toast } from "sonner";

export const GroupMusicContext = createContext(null);

export function GroupMusicProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useProfile();
  const [currentGroup, setCurrentGroup] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [groupMembers, setGroupMembers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSong, setCurrentSong] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const audioRef = useRef(null);

  const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const updateMediaSession = useCallback(
    (song) => {
      if (!("mediaSession" in navigator)) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: song?.artist_map?.artists
          ?.slice(0, 3)
          ?.map((artist) => artist.name)
          .join(", "),
        album: song?.album,
        artwork: song.image?.[2]?.link
          ? [{ src: song.image[2].link, sizes: "500x500", type: "image/jpeg" }]
          : [],
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play().catch(console.error);
        setIsPlaying(true);
        socket.emit("music-playback", {
          groupId: currentGroup?.id,
          isPlaying: true,
          currentTime: audioRef.current?.currentTime || 0,
          scheduledTime: Date.now() + serverTimeOffset + 100,
        });
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setIsPlaying(false);
        socket.emit("music-playback", {
          groupId: currentGroup?.id,
          isPlaying: false,
          currentTime: audioRef.current?.currentTime || 0,
          scheduledTime: Date.now() + serverTimeOffset + 100,
        });
      });

      document.title = `${song.name} - SyncVibe`;
    },
    [audioRef],
  );

  useEffect(() => {
    if (currentSong) {
      updateMediaSession(currentSong);
    }
  }, [currentSong, updateMediaSession]);

  const loadAudio = async (url) => {
    try {
      setIsLoading(true);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();

        audioRef.current.onloadedmetadata = () => {
          setDuration(audioRef.current.duration);
          setIsLoading(false);
        };

        audioRef.current.ontimeupdate = () => {
          setCurrentTime(audioRef.current.currentTime);
        };

        audioRef.current.onended = () => {
          setIsPlaying(false);
          socket.emit("music-playback", {
            groupId: currentGroup?.id,
            isPlaying: false,
            currentTime: 0,
            scheduledTime: Date.now() + serverTimeOffset + 100,
          });
        };

        audioRef.current.volume = volume;
      }
    } catch (error) {
      console.error("Error loading audio:", error);
      toast.error("Failed to load audio");
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    const newIsPlaying = !isPlaying;
    const currentAudioTime = audioRef.current?.currentTime || 0;

    try {
      const scheduledTime = Date.now() + serverTimeOffset + 300;

      socket.emit("music-playback", {
        groupId: currentGroup?.id,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      });

      const now = Date.now() + serverTimeOffset;
      const delay = Math.max(0, scheduledTime - now);

      const executePlayback = async () => {
        if (newIsPlaying) {
          try {
            await audioRef.current.play();
          } catch (err) {
            console.error("Error playing audio:", err);
          }
        } else {
          audioRef.current.pause();
        }
        setIsPlaying(newIsPlaying);
      };

      setTimeout(executePlayback, delay);
    } catch (error) {
      console.error("Playback control error:", error);
    }
  };

  const handleSeek = (value) => {
    if (!audioRef.current) return;

    const newTime = value[0];
    audioRef.current.currentTime = newTime;

    const scheduledTime = Date.now() + serverTimeOffset + 100;
    socket.emit("music-seek", {
      groupId: currentGroup?.id,
      currentTime: newTime,
      scheduledTime,
      isPlaying,
    });
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const selectSong = async (song) => {
    try {
      setIsLoading(true);
      setCurrentSong(song);
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);

      const url = song.download_url.find(
        (url) => url.quality === "320kbps",
      ).link;
      await loadAudio(url);

      socket.emit("music-change", {
        groupId: currentGroup?.id,
        song,
        currentTime: 0,
        scheduledTime: Date.now() + serverTimeOffset + 100,
      });

      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      toast.error("Failed to load song");
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    _.debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearchLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`,
        );
        setSearchResults(response.data?.data?.results || []);
      } catch (error) {
        toast.error("Search failed. Please try again.");
      } finally {
        setIsSearchLoading(false);
      }
    }, 500),
    [],
  );

  const createGroup = (groupName) => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    socket.emit("create-music-group", {
      name: groupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
    setIsGroupModalOpen(false);
  };

  const joinGroup = (groupId) => {
    if (!groupId.trim()) return;

    socket.emit("join-music-group", {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
    setIsGroupModalOpen(false);
  };

  const leaveGroup = () => {
    if (!currentGroup) return;

    socket.emit("leave-group", {
      groupId: currentGroup.id,
      userId: user.userid,
    });

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setCurrentGroup(null);
    setCurrentSong(null);
    setIsPlaying(false);
    setMessages([]);
    setGroupMembers([]);
    toast.info(`Left group ${currentGroup.name}`);
  };

  const sendMessage = (message) => {
    if (!message.trim()) return;

    socket.emit("chat-message", {
      groupId: currentGroup?.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      message,
    });
  };

  useEffect(() => {
    if (socket) {
      const syncWithServer = () => {
        const startTime = Date.now();
        socket.emit("time-sync-request", {
          clientTime: startTime,
        });
      };

      socket.on("time-sync-response", (data) => {
        const endTime = Date.now();
        const roundTripTime = endTime - data.clientTime;
        const serverTime = data.serverTime + roundTripTime / 2;
        setServerTimeOffset(serverTime - endTime);
        setLastSync(endTime);
      });

      syncWithServer();
      const syncInterval = setInterval(syncWithServer, 30000);

      return () => {
        clearInterval(syncInterval);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("playback-update", (data) => {
      const serverNow = Date.now() + serverTimeOffset;
      const {
        isPlaying: newIsPlaying,
        currentTime: newTime,
        scheduledTime,
      } = data;
      const timeUntilPlay = scheduledTime - serverNow;

      if (audioRef.current) {
        audioRef.current.currentTime = newTime;

        if (newIsPlaying) {
          setTimeout(() => {
            audioRef.current.play();
            setIsPlaying(true);
          }, Math.max(0, timeUntilPlay));
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }

      setCurrentTime(newTime);
      setLastSync(serverNow);
    });

    socket.on("music-update", async ({ song, currentTime, scheduledTime }) => {
      setCurrentSong(song);
      const url = song.download_url.find(
        (url) => url.quality === "320kbps",
      ).link;

      await loadAudio(url);

      const timeUntilPlay = scheduledTime - (Date.now() + serverTimeOffset);

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = currentTime;
          if (isPlaying) {
            audioRef.current.play();
          }
        }
      }, Math.max(0, timeUntilPlay));
    });

    socket.on("group-created", (group) => {
      setCurrentGroup(group);
      setGroupMembers([
        {
          groupId: group.id,
          userId: user.userid,
          userName: user.name,
          profilePic: user.profilepic,
        },
      ]);
    });

    socket.on("group-joined", (data) => {
      const { group, members, playbackState } = data;
      setCurrentGroup(group);
      setGroupMembers(members);

      if (playbackState.currentTrack) {
        setCurrentSong(playbackState.currentTrack);
        loadAudio(playbackState.currentTrack.download_url[3].link);
      }

      if (playbackState.isPlaying) {
        const serverNow = Date.now() + serverTimeOffset;
        const timePassed = (serverNow - playbackState.lastUpdate) / 1000;
        const syncedTime = playbackState.currentTime + timePassed;

        if (audioRef.current) {
          audioRef.current.currentTime = syncedTime;
          audioRef.current.play();
        }
        setIsPlaying(true);
      }
    });

    socket.on("member-joined", (member) => {
      setGroupMembers((prev) => {
        if (prev.find((m) => m.userId === member.userId)) return prev;
        return [...prev, member];
      });
    });

    socket.on("member-left", ({ userId }) => {
      if (userId) {
        setGroupMembers((prev) =>
          prev.filter((member) => member.userId !== userId),
        );
      }
    });

    socket.on("group-disbanded", () => {
      setCurrentGroup(null);
      setCurrentSong(null);
      setIsPlaying(false);
      setMessages([]);
      setGroupMembers([]);
      toast.info("Group disbanded");
    });

    socket.on("new-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("playback-update");
      socket.off("music-update");
      socket.off("group-created");
      socket.off("group-joined");
      socket.off("member-joined");
      socket.off("member-left");
      socket.off("group-disbanded");
      socket.off("new-message");
    };
  }, [socket, isPlaying, serverTimeOffset, user, loadAudio]);

  const contextValue = {
    // States
    currentGroup,
    setCurrentGroup,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    groupMembers,
    setGroupMembers,
    searchResults,
    setSearchResults,
    searchQuery,
    setSearchQuery,
    currentSong,
    setCurrentSong,
    isSearchOpen,
    setIsSearchOpen,
    volume,
    setVolume,
    isLoading,
    setIsLoading,
    messages,
    setMessages,
    serverTimeOffset,
    setServerTimeOffset,
    lastSync,
    setLastSync,
    isGroupModalOpen,
    setIsGroupModalOpen,
    isSearchLoading,
    setIsSearchLoading,
    audioRef,

    // Functions
    formatTime,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    selectSong,
    debouncedSearch,
    createGroup,
    joinGroup,
    leaveGroup,
    sendMessage,
  };

  return (
    <GroupMusicContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} />
    </GroupMusicContext.Provider>
  );
}

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
};
