import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Users,
  Music,
  Search,
  LogOut,
  Volume2,
  Loader2,
} from 'lucide-react';
import { useSocket } from '@/Context/ChatContext';
import { useProfile } from '@/Context/Context';
import axios from 'axios';
import { toast } from 'sonner';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const GroupMusic = () => {
  const { socket } = useSocket();
  const { user } = useProfile();
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [groupMembers, setGroupMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Handle continuous time update
  useEffect(() => {
    if (audioRef.current) {
      const updateProgress = () => {
        setCurrentTime(audioRef.current.currentTime);
      };

      audioRef.current.addEventListener('timeupdate', updateProgress);
      return () => audioRef.current?.removeEventListener('timeupdate', updateProgress);
    }
  }, []);

  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchMusic(query);
    }, 500);
  }, []);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Add this to handle audio metadata loading
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onloadedmetadata = () => {
        setDuration(audioRef.current.duration); // This was missing
        setCurrentTime(0);
      };

      // Add this to handle audio loading errors
      audioRef.current.onerror = (e) => {
        console.error('Audio loading error:', e);
      };
    }
  }, [currentSong]);

  const selectSong = async (song) => {
    try {
      setCurrentSong(song);
      if (audioRef.current) {
        const url = song.download_url.find((url) => url.quality === '320kbps').link;
        audioRef.current.src = url;
        await audioRef.current.load(); // Wait for loading

        // Set initial state
        setDuration(audioRef.current.duration);
        setCurrentTime(0);

        // Emit to other users
        socket.emit('music-change', {
          groupId: currentGroup?.id,
          song,
          currentTime: 0,
          scheduledTime: Date.now() + serverTimeOffset + 100,
        });
      }
    } catch (error) {
      console.error('Error loading song:', error);
    }
  };

  const leaveGroup = () => {
    if (currentGroup) {
      socket.emit('leave-group', {
        groupId: currentGroup.id,
        userId: user.userid,
      });
      setCurrentGroup(null);
      setCurrentSong(null);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      toast.info(`Left group ${currentGroup.name}`);
    }
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Add socket listener for song changes
  useEffect(() => {
    if (socket) {
      socket.on('music-update', (data) => {
        console.log(data, 'song-changed');

        const { song, currentTime, scheduledTime } = data;
        setCurrentSong(song);

        if (audioRef.current) {
          audioRef.current.src = song.download_url.find((url) => url.quality === '320kbps').link;
          audioRef.current.load();
          audioRef.current.currentTime = currentTime;

          const timeUntilPlay = scheduledTime - (Date.now() + serverTimeOffset);
          if (isPlaying) {
            setTimeout(
              () => {
                audioRef.current.play();
              },
              Math.max(0, timeUntilPlay)
            );
          }
        }
      });

      return () => {
        socket.off('song-changed');
      };
    }
  }, [socket, serverTimeOffset, isPlaying]);

  // Add song duration update handler
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onloadedmetadata = () => {
        // Update UI with new duration
        setCurrentTime(0);
      };
    }
  }, [currentSong]);

  // Time synchronization with server
  useEffect(() => {
    if (socket) {
      const syncWithServer = () => {
        const startTime = Date.now();
        socket.emit('time-sync-request', {
          clientTime: startTime,
        });
      };

      socket.on('time-sync-response', (data) => {
        const endTime = Date.now();
        const roundTripTime = endTime - data.clientTime;
        const serverTime = data.serverTime + roundTripTime / 2;
        setServerTimeOffset(serverTime - endTime);
      });

      // Initial sync
      syncWithServer();

      // Periodic sync every 30 seconds
      const syncInterval = setInterval(syncWithServer, 30000);

      return () => {
        clearInterval(syncInterval);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (socket) {
      socket.on('group-created', (group) => {
        setGroups((prev) => [...prev, group]);
      });

      socket.on('group-joined', (data) => {
        const { group, members, playbackState } = data;
        setCurrentGroup(group);
        setGroupMembers(members);

        // Synchronize with current playback state
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

      socket.on('playback-update', (data) => {
        console.log(data, 'playback-update');

        const serverNow = Date.now() + serverTimeOffset;
        const { isPlaying, currentTime, scheduledTime } = data;

        // Calculate precise playback timing
        const timeUntilPlay = scheduledTime - serverNow;

        if (audioRef.current) {
          audioRef.current.currentTime = currentTime;

          if (isPlaying) {
            setTimeout(
              () => {
                audioRef.current.play();
                setIsPlaying(true);
              },
              Math.max(0, timeUntilPlay)
            );
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }

        setCurrentTime(currentTime);
        setLastSync(serverNow);
      });

      socket.on('member-joined', (member) => {
        setGroupMembers((prev) => [...prev, member]);
      });

      socket.on('member-left', (userId) => {
        setGroupMembers((prev) => prev.filter((member) => member.userId !== userId));
      });

      return () => {
        socket.off('group-created');
        socket.off('group-joined');
        socket.off('playback-update');
        socket.off('member-joined');
        socket.off('time-sync-response');
        socket.off('member-left');
      };
    }
  }, [socket, serverTimeOffset]);

  useEffect(() => {
    if (isPlaying && lastSync) {
      // Clear any existing sync interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      // Create new sync interval
      syncIntervalRef.current = setInterval(() => {
        const serverNow = Date.now() + serverTimeOffset;
        const expectedTime = currentTime + (serverNow - lastSync) / 1000;

        if (audioRef.current && Math.abs(audioRef.current.currentTime - expectedTime) > 0.1) {
          audioRef.current.currentTime = expectedTime;
        }
      }, 1000);

      // Cleanup on unmount or when playback stops
      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      };
    }
  }, [isPlaying, lastSync, currentTime]);

  // Also clear it when leaving a group or component unmounts
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);

  const createGroup = () => {
    if (newGroupName.trim()) {
      socket.emit('create-music-group', {
        name: newGroupName,
        createdBy: user.userid,
      });
      setNewGroupName('');
    }
  };

  const joinGroup = (groupId) => {
    socket.emit('join-music-group', {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
  };

  const handlePlayPause = async () => {
    const newIsPlaying = !isPlaying;
    const currentAudioTime = audioRef.current?.currentTime || 0;

    try {
      if (newIsPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } else {
        audioRef.current.pause();
      }

      const scheduledTime = Date.now() + serverTimeOffset + 100;
      socket.emit('music-playback', {
        groupId: currentGroup?.id,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      });
    } catch (error) {
      console.error('Playback control error:', error);
    }
  };

  const handleSeek = (value) => {
    const newTime = value[0];
    const scheduledTime = Date.now() + serverTimeOffset + 100;

    socket.emit('music-seek', {
      groupId: currentGroup?.id,
      currentTime: newTime,
      scheduledTime,
      isPlaying,
    });
  };

  const searchMusic = useCallback(async (query) => {
    try {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`);

      if (response.status === 200) {
        setSearchResults(response.data?.data?.results);
      }
    } catch (error) {
      console.error('Error fetching search data:', error);
    } finally {
    }
  }, []);

  console.log(groupMembers, 'groupMembers');

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <Card className='bg-background/60 backdrop-blur-lg border-none shadow-lg'>
        <CardHeader>
          <div className='flex justify-between items-center'>
            <CardTitle className='text-2xl font-bold'>Group Music Player</CardTitle>
            <div className='flex gap-2'>
              {currentGroup ? (
                <>
                  <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <DialogTrigger asChild>
                      <Button size='icon' variant='ghost'>
                        <Search className='h-4 w-4' />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-2xl'>
                      <DialogHeader>
                        <DialogTitle>Search Music</DialogTitle>
                      </DialogHeader>
                      <div className='space-y-4 pt-4'>
                        <Input
                          placeholder='Search songs...'
                          value={searchQuery}
                          onChange={handleSearchChange}
                        />
                        <ScrollArea className='h-[400px]'>
                          {searchResults?.map((song) => (
                            <div
                              key={song.id}
                              className='flex items-center gap-4 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors'
                              onClick={() => selectSong(song)}
                            >
                              <img
                                src={song.image[1].link}
                                alt={song.name}
                                className='w-12 h-12 rounded-lg'
                              />
                              <div>
                                <p className='font-medium line-clamp-1'>{song.name}</p>
                                <p className='text-sm text-muted-foreground'>
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
                    size='icon'
                    variant='ghost'
                    className='text-destructive'
                    onClick={leaveGroup}
                  >
                    <LogOut className='h-4 w-4' />
                  </Button>
                </>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size='icon' variant='ghost'>
                      <Plus className='h-4 w-4' />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Music Group</DialogTitle>
                    </DialogHeader>
                    <div className='space-y-4 pt-4'>
                      <Input
                        placeholder='Group Name'
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <Button onClick={createGroup} className='w-full'>
                        Create Group
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
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Available Groups</h3>
              <ScrollArea className='h-[400px] pr-4'>
                {groups.map((group) => (
                  <Card key={group.id} className='mb-3 transition-all hover:shadow-md'>
                    <CardContent className='p-4 flex justify-between items-center'>
                      <div className='flex items-center gap-3'>
                        <div className='bg-primary/10 p-3 rounded-full'>
                          <Music className='h-6 w-6 text-primary' />
                        </div>
                        <div>
                          <p className='font-medium'>{group.name}</p>
                          <p className='text-sm text-muted-foreground'>
                            Created by {group.createdBy}
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => joinGroup(group.id)}>Join Group</Button>
                    </CardContent>
                  </Card>
                ))}
              </ScrollArea>
            </div>
          ) : (
            <div className='space-y-6'>
              <div className='flex justify-between items-center'>
                <div>
                  <h3 className='text-lg font-semibold'>{currentGroup.name}</h3>
                  <p className='text-sm text-muted-foreground'>
                    Created by {currentGroup.createdBy}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Users className='h-4 w-4' />
                  <span>{groupMembers.length} members</span>
                </div>
              </div>

              <div className='bg-accent/50 rounded-lg p-6'>
                {isLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <Loader2 className='h-8 w-8 animate-spin' />
                  </div>
                ) : currentSong ? (
                  <div className='space-y-6'>
                    <div className='flex items-center gap-6'>
                      <img
                        src={currentSong.image[1].link}
                        alt={currentSong.name}
                        className='w-24 h-24 rounded-lg shadow-lg'
                      />
                      <div>
                        <h4 className='text-xl font-semibold line-clamp-1'>{currentSong.name}</h4>
                        <p className='text-muted-foreground'>
                          {currentSong.artist_map.primary_artists[0].name}
                        </p>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={1}
                        onValueChange={handleSeek}
                        className='cursor-pointer'
                      />
                      <div className='flex justify-between text-sm text-muted-foreground'>
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    <div className='flex flex-col gap-4'>
                      <div className='flex justify-center items-center gap-4'>
                        <Button variant='outline' size='icon' className='rounded-full'>
                          <SkipBack className='h-4 w-4' />
                        </Button>
                        <Button
                          size='icon'
                          className='rounded-full h-12 w-12'
                          onClick={handlePlayPause}
                        >
                          {isPlaying ? (
                            <Pause className='h-6 w-6' />
                          ) : (
                            <Play className='h-6 w-6 ml-1' />
                          )}
                        </Button>
                        <Button variant='outline' size='icon' className='rounded-full'>
                          <SkipForward className='h-4 w-4' />
                        </Button>
                      </div>

                      <div className='flex items-center gap-2'>
                        <Volume2 className='h-4 w-4' />
                        <Slider
                          value={[volume]}
                          max={1}
                          step={0.01}
                          onValueChange={handleVolumeChange}
                          className='w-24'
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-8 text-muted-foreground'>
                    <Music className='h-12 w-12 mx-auto mb-4 opacity-50' />
                    <p>No song selected</p>
                    <p className='text-sm'>Click the search icon to find music</p>
                  </div>
                )}
              </div>

              <audio ref={audioRef} />

              <div>
                <h4 className='font-medium mb-3'>Group Members</h4>
                <ScrollArea className='h-[200px]'>
                  <div className='space-y-2'>
                    {groupMembers.map((member) => (
                      <div
                        key={member.userId}
                        className='flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50'
                      >
                        <Avatar>
                          <AvatarImage src={member.profilePic} />
                          <AvatarFallback>{member.userName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{member.userName}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupMusic;
