import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/Context/Context";
import { useGroupMusic } from "@/Context/GroupMusicContext";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { SendIcon } from "lucide-react";
import {
  AudioLines,
  CopyIcon,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Users,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const GroupMusic = () => {
  const { user } = useProfile();
  const {
    currentGroup,
    setCurrentGroup,
    isPlaying,
    currentTime,
    duration,
    groupMembers,
    searchResults,
    searchQuery,
    setSearchQuery,
    currentSong,
    isSearchOpen,
    setIsSearchOpen,
    volume,
    isLoading,
    messages,
    isGroupModalOpen,
    setIsGroupModalOpen,
    isSearchLoading,
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
  } = useGroupMusic();

  const [newGroupName, setNewGroupName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [groupId, setGroupId] = useState("");

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSendMessage = () => {
    if (!newMessage) return;
    sendMessage(newMessage);
    setNewMessage("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentGroup.id);
    toast("Group ID copied to clipboard", "success");
  };

  return (
    <div className="mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-background/95 to-background/50 backdrop-blur-xl border-none shadow-2xl overflow-hidden p-0 m-0">
          <CardHeader className="pb-4 m-0 p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-md md:text-3xl font-bold flex items-center justify-center gap-4">
                <Music className="h-8 w-8 text-primary" />
                Group Music Player
              </CardTitle>
              {currentGroup && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 rounded-full transition-all"
                >
                  <Button
                    onClick={() => setIsSearchOpen(true)}
                    className="rounded-full px-6 py-2"
                    variant="outline"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search for a song
                  </Button>
                </motion.div>
              )}
              {currentGroup && (
                <div className="flex gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 bg-primary/10 px-4 rounded-full transition-all hover:bg-primary/20"
                  >
                    <p className="text-sm font-medium">
                      Group ID: {currentGroup?.id}
                    </p>
                    <Button
                      onClick={handleCopy}
                      className="rounded-full"
                      variant="ghost"
                      size="icon"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </motion.div>
                  <Button
                    onClick={leaveGroup}
                    className="rounded-full"
                    variant="destructive"
                    color="danger"
                    size="icon"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {!currentGroup ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8 py-[100px]"
                >
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold">
                      Welcome to Group Music Player
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Create a new group or join an existing one to start
                      listening to music together with your friends.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsGroupModalOpen(true)}
                      className="text-lg px-8 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      <Plus className="mr-2 h-5 w-5 inline-block" /> Create or
                      Join a Group
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="group-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-4"
                >
                  {/* Current playback section */}
                  <div className="bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl p-8 shadow-lg transition-all hover:shadow-xl">
                    {currentSong ? (
                      <div className="flex gap-8">
                        <img
                          src={currentSong.image[1].link}
                          alt={currentSong.name}
                          className="h-48 w-48 rounded-lg object-cover"
                        />
                        <div className="flex-1 space-y-6">
                          <div>
                            <h3 className="text-2xl font-medium mb-2">
                              {currentSong.name}
                            </h3>
                            <p className="text-zinc-400">
                              {currentSong.artist_map.primary_artists[0].name}
                            </p>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <Slider
                              onValueChange={handleSeek}
                              value={[currentTime]}
                              max={duration}
                              step={1}
                              className="h-1"
                            />
                            <div className="flex justify-between text-sm text-zinc-400">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10"
                              >
                                <SkipBack className="h-5 w-5" />
                              </Button>
                              <Button
                                size="icon"
                                onClick={handlePlayPause}
                                className="h-12 w-12 bg-white text-black hover:bg-zinc-200 rounded-full"
                              >
                                {isPlaying ? (
                                  <Pause className="h-6 w-6" />
                                ) : (
                                  <Play className="h-6 w-6 ml-1" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10"
                              >
                                <SkipForward className="h-5 w-5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 w-48">
                              <Volume2 className="h-4 w-4" />
                              <Slider
                                value={[volume]}
                                max={1}
                                step={0.01}
                                onValueChange={handleVolumeChange}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        className="text-center py-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <AudioLines className="h-20 w-20 mx-auto mb-2 text-primary/50 animate-pulse" />
                        <p className="text-2xl font-medium mb-2">
                          No song playing
                        </p>
                        <p className="text-muted-foreground">
                          Search and select a song to start the party
                        </p>
                        <Button
                          onClick={() => setIsSearchOpen(true)}
                          className="mt-6 rounded-full px-6 py-2"
                          variant="outline"
                        >
                          <Search className="mr-2 h-4 w-4" /> Search for a song
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  {/* Chat and Members section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 transition-all hover:shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          Group Chat
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px] mb-4 p-4">
                          <motion.div className="space-y-4">
                            <AnimatePresence>
                              {messages.map((msg, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -20 }}
                                  transition={{ duration: 0.3 }}
                                  className={`flex gap-2 ${
                                    msg.senderId === user.userid
                                      ? "justify-end"
                                      : "justify-start"
                                  }`}
                                >
                                  <div
                                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                      msg.senderId === user.userid
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                    }`}
                                  >
                                    <p className="text-sm font-medium mb-1">
                                      {msg.userName}
                                    </p>
                                    <p>{msg.message}</p>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        </ScrollArea>
                        <div className="flex gap-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            onKeyPress={(e) =>
                              e.key === "Enter" && handleSendMessage()
                            }
                            className="rounded-full"
                          />
                          <Button
                            onClick={handleSendMessage}
                            className="rounded-full"
                            variant="ghost"
                            size="icon"
                          >
                            <SendIcon className="h-5 w-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="transition-all hover:shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          Group Members
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[450px]">
                          <motion.div className="space-y-2">
                            <AnimatePresence>
                              {groupMembers.map((member) => (
                                <motion.div
                                  key={member.userId}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 20 }}
                                  transition={{ duration: 0.3 }}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-all hover:translate-x-1"
                                >
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.profilePic} />
                                    <AvatarFallback>
                                      {member.userName?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">
                                    {member.userName}
                                  </span>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {isGroupModalOpen && (
        <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center mb-4">
                Create or Join a Group
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create Group</TabsTrigger>
                <TabsTrigger value="join">Join Group</TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="space-y-4 mt-4">
                <Input
                  placeholder="Enter group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="rounded-full"
                />
                <Button
                  onClick={() => createGroup(newGroupName)}
                  className="w-full rounded-full"
                >
                  Create Group
                </Button>
              </TabsContent>
              <TabsContent value="join" className="space-y-4 mt-4">
                <Input
                  placeholder="Enter group ID"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="rounded-full"
                />
                <Button
                  onClick={() => joinGroup(groupId)}
                  className="w-full rounded-full"
                >
                  Join Group
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {isSearchOpen && (
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-xl">
            <DialogHeader>
              <DialogTitle>Search Music</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search songs..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-zinc-800 border-zinc-700"
              />
              <ScrollArea className="h-[400px]">
                {isSearchLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults?.map((song) => (
                      <div
                        key={song.id}
                        onClick={() => selectSong(song)}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
                      >
                        <img
                          src={song.image[1].link}
                          alt={song.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                        <div>
                          <p className="font-medium">{song.name}</p>
                          <p className="text-sm text-zinc-400">
                            {song.artist_map.primary_artists[0].name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default GroupMusic;
