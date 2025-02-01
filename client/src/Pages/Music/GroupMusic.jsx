import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useSocket } from "@/Context/ChatContext";
import { useProfile } from "@/Context/Context";
import axios from "axios";
import _ from "lodash";
import {
  AudioLines,
  CopyIcon,
  LogOut,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const formatTime = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const GroupMusic = () => {
  const { socket } = useSocket();
  const { user } = useProfile();
  const [currentGroup, setCurrentGroup] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [groupMembers, setGroupMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSong, setCurrentSong] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  const [groupId, setGroupId] = useState("");

  const audioRef = useRef(null);

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
      // Add buffer time to account for network latency and processing time
      const scheduledTime = Date.now() + serverTimeOffset + 300; // increased buffer to 300ms

      // Emit the playback change to server
      socket.emit("music-playback", {
        groupId: currentGroup?.id,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      });

      // Calculate the delay accounting for serverTimeOffset
      const now = Date.now() + serverTimeOffset;
      const delay = Math.max(0, scheduledTime - now);

      // Use an async function to properly handle the play promise
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

      // Schedule the playback
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
        setIsLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`,
        );
        setSearchResults(response.data?.data?.results || []);
      } catch (error) {
        toast.error("Search failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [],
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const createGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    socket.emit("create-music-group", {
      name: newGroupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
    setNewGroupName("");
    toast.success("Group created successfully");
  };

  const joinGroup = () => {
    if (!groupId.trim()) return;

    socket.emit("join-music-group", {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
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

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    socket.emit("chat-message", {
      groupId: currentGroup?.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      message: newMessage,
    });

    setNewMessage("");
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
      const { isPlaying, currentTime, scheduledTime } = data;
      const timeUntilPlay = scheduledTime - serverNow;

      if (audioRef.current) {
        audioRef.current.currentTime = currentTime;

        if (isPlaying) {
          setTimeout(() => {
            audioRef.current.play();
            setIsPlaying(true);
          }, Math.max(0, timeUntilPlay));
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }

      setCurrentTime(currentTime);
      setLastSync(serverNow);
    });

    socket.on(
      "music-seek",
      ({ currentTime: newTime, scheduledTime, isPlaying: shouldPlay }) => {
        if (!audioRef.current) return;

        const timeUntilSeek = scheduledTime - (Date.now() + serverTimeOffset);

        setTimeout(() => {
          audioRef.current.currentTime = newTime;
          setIsPlaying(shouldPlay);

          if (shouldPlay) {
            audioRef.current.play();
          } else {
            audioRef.current.pause();
          }
        }, Math.max(0, timeUntilSeek));
      },
    );

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

    socket.on("group-not-found", () => {
      toast.error("Group not found. Please check the ID and try again");
    });

    socket.on("group-joined", (data) => {
      toast.success(`Joined group ${data.group.name}`);
      const { group, members, playbackState } = data;
      setCurrentGroup(group);
      setGroupMembers(members);

      if (playbackState.currentSong) {
        console.log(playbackState.currentSong, "playbackState.currentSong");

        setCurrentSong(playbackState.currentSong);
        loadAudio(playbackState.currentSong.download_url[3].link);
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
        setCurrentTime(syncedTime);
        setLastSync(serverNow);
      }
    });

    socket.on("member-joined", (member) => {
      setGroupMembers((prev) => {
        if (prev.find((m) => m.userId === member.userId)) return prev;
        return [...prev, member];
      });
    });

    socket.on("member-left", (userId) => {
      setGroupMembers((prev) =>
        prev.filter((member) => member.userId !== userId),
      );
      toast.info("A member left the group");
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
      socket.off("music-seek");
      socket.off("playback-update");
      socket.off("music-update");
      socket.off("group-created");
      socket.off("group-joined");
      socket.off("chat-message");
      socket.off("member-joined");
      socket.off("member-left");
      socket.off("group-disbanded");
      socket.off("new-message");
    };
  }, [socket]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentGroup?.id);
    toast.success("Group ID copied to clipboard");
  };

  return (
    <div className="mx-auto p-2">
      <Card className="bg-gradient-to-br from-background/95 to-background/50 backdrop-blur-xl border-none shadow-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-4">
              Group Music Player
              {currentGroup && (
                <div className="flex gap-2 bg-slate-800 px-3 rounded-full items-center">
                  <p className="text-sm flex items-center">
                    {currentGroup?.id}
                  </p>
                  <Button
                    onClick={handleCopy}
                    className="flex items-center rounded-full"
                    variant="ghost"
                    size="icon"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {currentGroup ? (
                <>
                  <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <Search className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Search Music</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Input
                          placeholder="Search songs..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                        />
                        <ScrollArea className="h-[500px]">
                          {searchResults?.map((song) => (
                            <div
                              key={song.id}
                              className="flex items-center gap-4 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                              onClick={() => selectSong(song)}
                            >
                              <img
                                src={song.image[1].link}
                                alt={song.name}
                                className="w-12 h-12 rounded-lg"
                              />
                              <div>
                                <p className="font-medium line-clamp-1">
                                  {song.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {song.artist_map.primary_artists[0].name}
                                </p>
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={leaveGroup}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Music Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Input
                        placeholder="Group Name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <Button onClick={createGroup} className="w-full">
                        Create Group
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-center pt-4">
                      Or, join an existing group
                    </p>
                    <div className="space-y-4 pt-4">
                      <Input
                        placeholder="Group ID"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                      />
                      <Button onClick={joinGroup} className="w-full">
                        Join Group
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!currentGroup ? (
            <div className="space-y-4">
              <p className="text-lg font-medium">
                Create or join a group to start listening to music together
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Current playback section */}
              <div className="bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl p-8">
                {currentSong ? (
                  <div className="space-y-6">
                    {/* Song info and controls */}
                    <div className="flex items-center gap-8">
                      <img
                        src={currentSong.image[1].link}
                        alt={currentSong.name}
                        className="w-32 h-32 rounded-2xl shadow-2xl transition-transform hover:scale-105"
                      />
                      <div className="space-y-2">
                        <h4 className="text-2xl font-bold">
                          {currentSong.name}
                        </h4>
                        <p className="text-muted-foreground">
                          {currentSong.artist_map.primary_artists[0].name}
                        </p>
                      </div>
                    </div>

                    {/* Playback progress */}
                    <div className="space-y-2">
                      <Progress
                        value={(currentTime / duration) * 100}
                        className="h-2"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Playback controls */}
                    <div className="flex justify-center items-center gap-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-12 w-12 hover:scale-110 transition-transform"
                      >
                        <SkipBack className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        className="rounded-full h-16 w-16 bg-primary hover:bg-primary/90 hover:scale-110 transition-transform"
                        onClick={handlePlayPause}
                      >
                        {isPlaying ? (
                          <Pause className="h-8 w-8" />
                        ) : (
                          <Play className="h-8 w-8 ml-1" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-12 w-12 hover:scale-110 transition-transform"
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Volume control */}
                    <div className="flex items-center gap-2 justify-center">
                      <Volume2 className="h-4 w-4" />
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        className="w-32"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AudioLines className="h-16 w-16 mx-auto mb-4 text-primary/50 animate-pulse" />
                    <p className="text-lg font-medium">No song playing</p>
                    <p className="text-sm text-muted-foreground">
                      Search and select a song to start the party
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Group Chat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px] mb-4">
                      <div className="space-y-4">
                        {messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex gap-2 ${
                              msg.senderId === user.userid ? "justify-end" : ""
                            }`}
                          >
                            <div
                              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                msg.senderId === user.userid
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <p className="text-sm font-medium">
                                {msg.userName}
                              </p>
                              <p>{msg.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleSendMessage()
                        }
                      />
                      <Button onClick={handleSendMessage}>Send</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Group Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {groupMembers.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profilePic} />
                              <AvatarFallback>
                                {member.userName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {member.userName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <audio ref={audioRef} />
    </div>
  );
};

export default GroupMusic;
