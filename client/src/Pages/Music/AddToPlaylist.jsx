import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaylist } from "@/Context/PlayerContext";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Check,
  ListMusic,
  Loader2,
  Music,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const AddToPlaylist = ({ dialogOpen, setDialogOpen, song }) => {
  const { userPlaylist, getPlaylists } = usePlaylist();
  const [newPlaylistDialog, setNewPlaylistDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingSong, setAddingSong] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [addingSuccess, setAddingSuccess] = useState(false);

  const filteredPlaylists = userPlaylist?.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/playlist/create`,
        { name: newPlaylistName },
        { withCredentials: true },
      );

      if (response.status === 200) {
        toast.success("Playlist created successfully");
        await getPlaylists();
        setNewPlaylistDialog(false);
        setNewPlaylistName("");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create playlist");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!playlistId || !song) {
      return toast.error("An error occurred. Please try again.");
    }

    setSelectedPlaylistId(playlistId);
    setAddingSong(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/playlist/add-song`,
        {
          playlistId,
          songId: song.id,
          songData: JSON.stringify(song),
        },
        { withCredentials: true },
      );

      if (response.status === 201) {
        setAddingSuccess(true);
        setTimeout(() => {
          setDialogOpen(false);
          setAddingSuccess(false);
          setSelectedPlaylistId(null);
        }, 1500);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "An error occurred.");
      setSelectedPlaylistId(null);
    } finally {
      setAddingSong(false);
    }
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ListMusic className="w-5 h-5" />
              Add to Playlist
            </DialogTitle>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 h-10 text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              onClick={() => setNewPlaylistDialog(true)}
              disabled={loading}
            >
              <Plus className="w-5 h-5" />
              Create New Playlist
            </Button>

            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center h-[300px] justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredPlaylists?.length > 0 ? (
                <div className="space-y-2">
                  {filteredPlaylists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg
                        transition-all duration-200
                        ${
                          selectedPlaylistId === playlist.id
                            ? "bg-primary/10"
                            : "hover:bg-accent"
                        }
                        ${
                          addingSong && selectedPlaylistId !== playlist.id
                            ? "opacity-50 pointer-events-none"
                            : "cursor-pointer"
                        }
                      `}
                      onClick={() =>
                        !addingSong && handleAddToPlaylist(playlist.id)
                      }
                    >
                      <Avatar className="w-12 h-12 rounded-lg">
                        <AvatarImage
                          src={playlist.image}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10">
                          <Music className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-grow">
                        <p className="font-medium">{playlist.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {playlist.songCount || 0} songs
                        </p>
                      </div>
                      {selectedPlaylistId === playlist.id && (
                        <div className="flex items-center">
                          {addingSuccess ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
                            >
                              <Check className="w-5 h-5 text-white" />
                            </motion.div>
                          ) : (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-2">
                  <Music className="w-12 h-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "No matching playlists found"
                      : "No playlists found. Create one to get started!"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newPlaylistDialog} onOpenChange={setNewPlaylistDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlaylist} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlistName">Playlist Name</Label>
              <Input
                id="playlistName"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                required
                disabled={loading}
                className="h-12"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setNewPlaylistDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12"
                disabled={loading || !newPlaylistName.trim()}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Playlist"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddToPlaylist;
