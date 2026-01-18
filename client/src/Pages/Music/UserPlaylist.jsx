import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { UserPlaylistCard } from "./Cards"
import { useUserPlaylistsQuery } from "@/hooks/queries/usePlaylistQueries"
import {
  useCreatePlaylistMutation,
  useUpdatePlaylistMutation,
  useDeletePlaylistMutation,
} from "@/hooks/mutations/usePlaylistMutations"

const PlaylistDialog = ({ isOpen, onOpenChange, onSubmit, initialData, isLoading }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    if (initialData?.id) {
      setFormData({
        id: initialData.id,
        name: initialData.name || "",
        description: initialData.description || "",
      })
    } else {
      setFormData({
        name: "",
        description: "",
      })
    }
  }, [initialData?.id, initialData?.name])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit Playlist" : "Create New Playlist"}</DialogTitle>
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Add a description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
  )
}

const UserPlaylist = () => {
  const { data: userPlaylist = [] } = useUserPlaylistsQuery()
  const [playlistDialog, setPlaylistDialog] = useState({
    isOpen: false,
    data: null,
  })

  const createMutation = useCreatePlaylistMutation({
    onSuccess: () => {
      toast.success("Playlist created successfully!")
      setPlaylistDialog({ isOpen: false, data: null })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || "An error occurred.")
    },
  })

  const updateMutation = useUpdatePlaylistMutation({
    onSuccess: () => {
      toast.success("Playlist updated successfully!")
      setPlaylistDialog({ isOpen: false, data: null })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || "An error occurred.")
    },
  })

  const deleteMutation = useDeletePlaylistMutation({
    onSuccess: () => {
      toast.success("Playlist deleted successfully!")
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "An error occurred.")
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handlePlaylistSubmit = (formData) => {
    if (formData.id) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDeletePlaylist = (playlistId) => {
    deleteMutation.mutate(playlistId)
  }

  return (
    <div className="p-5 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Playlists</h2>
        <Button onClick={() => setPlaylistDialog({ isOpen: true, data: null })} className="gap-2">
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
            onEdit={(playlist) => setPlaylistDialog({ isOpen: true, data: playlist })}
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
        isLoading={isLoading}
      />
    </div>
  )
}

export default UserPlaylist
