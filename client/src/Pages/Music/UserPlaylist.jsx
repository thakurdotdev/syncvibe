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
import { Loader2, Plus, ListMusic, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { UserPlaylistCard } from "./Cards"
import { useUserPlaylistsQuery } from "@/hooks/queries/usePlaylistQueries"
import {
  useCreatePlaylistMutation,
  useUpdatePlaylistMutation,
  useDeletePlaylistMutation,
} from "@/hooks/mutations/usePlaylistMutations"
import { motion, AnimatePresence } from "framer-motion"

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
      <DialogContent className="sm:max-w-[400px] rounded-2xl p-0 overflow-hidden liquid-glass border border-border/30 shadow-2xl">
        <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-transparent p-5 pb-4 border-b border-border/10">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <ListMusic className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight">
              {initialData?.id ? "Edit Playlist" : "Create New Playlist"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground/75 font-medium ml-1">
            {initialData?.id
              ? "Update your playlist details below."
              : "Give your new playlist a name and description."}
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 ml-1">
                Playlist Name
              </label>
              <Input
                placeholder="e.g. Late Night Vibes"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-11 rounded-xl bg-background/30 border border-border/30 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm placeholder:text-muted-foreground/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 ml-1">
                Description
              </label>
              <Textarea
                placeholder="Add an optional description for this collection..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="resize-none rounded-xl bg-background/30 border border-border/30 focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[90px] text-sm placeholder:text-muted-foreground/40 transition-all"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/20 text-primary-foreground font-bold shadow-md cursor-pointer active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : initialData?.id ? (
                "Save Changes"
              ) : (
                "Create Playlist"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const UserPlaylist = () => {
  const { data: userPlaylist = [], isLoading: isDataLoading } = useUserPlaylistsQuery()
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
    <div className="p-4 md:p-6 max-w-350 mx-auto w-full space-y-6">
      <div className="flex flex-row justify-between items-start sm:items-center gap-4">

        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">My Playlists</h2>

        <Button
          onClick={() => setPlaylistDialog({ isOpen: true, data: null })}
          className="gap-2 h-10 rounded-xl px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md cursor-pointer transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Playlist
        </Button>
      </div>

      {isDataLoading ? (
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : userPlaylist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-accent/5 rounded-[32px] border border-dashed border-border/40">
          <div className="p-6 rounded-full bg-accent/10 mb-6">
            <ListMusic className="w-16 h-16 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-foreground">No playlists found</h3>
          <p className="text-muted-foreground font-medium mb-8 max-w-sm text-center">
            Create your first playlist and start building your collection!
          </p>
          <Button
            variant="outline"
            onClick={() => setPlaylistDialog({ isOpen: true, data: null })}
            className="rounded-xl px-8 h-12 border-primary/20 hover:bg-primary/5 text-primary font-bold"
          >
            Create Playlist
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
          <AnimatePresence mode="popLayout">
            {userPlaylist.map((playlist, index) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <UserPlaylistCard
                  playlist={playlist}
                  onDelete={handleDeletePlaylist}
                  onEdit={(playlist) => setPlaylistDialog({ isOpen: true, data: playlist })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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
