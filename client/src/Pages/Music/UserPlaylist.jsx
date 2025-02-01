import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePlaylist } from "@/Context/PlayerContext";
import axios from "axios";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlaylistCard } from "./Cards";

const PlaylistDialog = ({
  isOpen,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        name: initialData.name || "",
        description: initialData.description || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
      });
    }
  }, [initialData?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Playlist" : "Create New Playlist"}
          </DialogTitle>
          <DialogDescription>
            {initialData?.id
              ? "Update your playlist details below."
              : "Fill in the details for your new playlist."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Playlist Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Add a description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData?.id ? "Save Changes" : "Create Playlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UserPlaylist = () => {
  const { userPlaylist, getPlaylists } = usePlaylist();
  const [loading, setLoading] = useState(false);
  const [playlistDialog, setPlaylistDialog] = useState({
    isOpen: false,
    data: null,
  });

  const handlePlaylistSubmit = async (formData) => {
    setLoading(true);
    try {
      if (formData.id) {
        // Edit existing playlist
        const response = await axios.patch(
          `${import.meta.env.VITE_API_URL}/api/playlist/update`,
          formData,
          { withCredentials: true },
        );
        toast.success("Playlist updated successfully!");
      } else {
        // Create new playlist
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/playlist/create`,
          formData,
          { withCredentials: true },
        );
        toast.success("Playlist created successfully!");
      }
      getPlaylists();
      setPlaylistDialog({ isOpen: false, data: null });
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || "An error occurred.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    setLoading(true);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/playlist/delete`,
        {
          data: { playlistId },
          withCredentials: true,
        },
      );
      toast.success("Playlist deleted successfully!");
      getPlaylists();
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "An error occurred.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Playlists</h2>
        <Button
          onClick={() => setPlaylistDialog({ isOpen: true, data: null })}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Playlist
        </Button>
      </div>

      <div className="flex flex-wrap">
        {userPlaylist.map((playlist) => (
          <UserPlaylistCard
            key={playlist.id}
            playlist={playlist}
            onDelete={handleDeletePlaylist}
            onEdit={(playlist) =>
              setPlaylistDialog({ isOpen: true, data: playlist })
            }
          />
        ))}
      </div>

      <PlaylistDialog
        isOpen={playlistDialog.isOpen}
        onOpenChange={(open) =>
          setPlaylistDialog({
            isOpen: open,
            data: open ? playlistDialog.data : null,
          })
        }
        onSubmit={handlePlaylistSubmit}
        initialData={playlistDialog.data}
        isLoading={loading}
      />
    </div>
  );
};

export default UserPlaylist;
