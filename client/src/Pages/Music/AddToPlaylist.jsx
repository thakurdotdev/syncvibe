import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/revola"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion } from "framer-motion"
import { Check, ListMusic, Loader2, Music, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useUserPlaylistsQuery } from "@/hooks/queries/usePlaylistQueries"
import {
  useCreatePlaylistMutation,
  useAddSongToPlaylistMutation,
} from "@/hooks/mutations/usePlaylistMutations"

const AddToPlaylist = ({ dialogOpen, setDialogOpen, song }) => {
  const { data: userPlaylist = [] } = useUserPlaylistsQuery()
  const [newPlaylistDialog, setNewPlaylistDialog] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [addingSuccess, setAddingSuccess] = useState(false)

  const createMutation = useCreatePlaylistMutation({
    onSuccess: () => {
      toast.success("Playlist created successfully")
      setNewPlaylistDialog(false)
      setNewPlaylistName("")
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create playlist")
    },
  })

  const addSongMutation = useAddSongToPlaylistMutation({
    onSuccess: () => {
      setAddingSuccess(true)
      setTimeout(() => {
        setDialogOpen(false)
        setAddingSuccess(false)
        setSelectedPlaylistId(null)
      }, 1500)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "An error occurred.")
      setSelectedPlaylistId(null)
    },
  })

  const filteredPlaylists = userPlaylist?.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleCreatePlaylist = (e) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    createMutation.mutate({ name: newPlaylistName })
  }

  const handleAddToPlaylist = (playlistId) => {
    if (!playlistId || !song) {
      return toast.error("An error occurred. Please try again.")
    }

    setSelectedPlaylistId(playlistId)
    addSongMutation.mutate({
      playlistId,
      songId: song.id,
      songData: song,
    })
  }

  return (
    <>
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="sm:max-w-md p-0">
          <ResponsiveDialogHeader className="space-y-4 px-4 pt-4 sm:px-6 sm:pt-6">
            <ResponsiveDialogTitle className="flex items-center gap-2 text-xl">
              <ListMusic className="w-5 h-5" />
              Add to Playlist
            </ResponsiveDialogTitle>

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
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-2 px-4 pb-6 sm:px-6">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 h-10 text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              onClick={() => setNewPlaylistDialog(true)}
              disabled={createMutation.isPending}
            >
              <Plus className="w-5 h-5" />
              Create New Playlist
            </Button>

            <ScrollArea className="h-[400px] pr-4">
              {createMutation.isPending ? (
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
                        ${selectedPlaylistId === playlist.id ? "bg-primary/10" : "hover:bg-accent"}
                        ${
                          addSongMutation.isPending && selectedPlaylistId !== playlist.id
                            ? "opacity-50 pointer-events-none"
                            : "cursor-pointer"
                        }
                      `}
                      onClick={() => !addSongMutation.isPending && handleAddToPlaylist(playlist.id)}
                    >
                      <Avatar className="w-12 h-12 rounded-lg">
                        <AvatarImage src={playlist.image} className="object-cover" />
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
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={newPlaylistDialog} onOpenChange={setNewPlaylistDialog}>
        <ResponsiveDialogContent className="sm:max-w-md p-0">
          <ResponsiveDialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <ResponsiveDialogTitle className="text-xl">Create New Playlist</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <form onSubmit={handleCreatePlaylist} className="space-y-4 px-4 pb-6 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="playlistName">Playlist Name</Label>
              <Input
                id="playlistName"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                required
                disabled={createMutation.isPending}
                className="h-12"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setNewPlaylistDialog(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12"
                disabled={createMutation.isPending || !newPlaylistName.trim()}
              >
                {createMutation.isPending ? (
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
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}

export default AddToPlaylist
