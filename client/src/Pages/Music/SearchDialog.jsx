import { Loader2, Search, X, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useBackendSearchQuery } from "@/hooks/queries/useSongQueries"
import { SongCard } from "./Cards"

const SearchDialog = ({ open, setOpen }) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: searchResults, isLoading } = useBackendSearchQuery(debouncedQuery)

  const handleClose = useCallback(() => {
    setOpen(false)
    setSearchQuery("")
    setDebouncedQuery("")
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        closeButton={false}
        className="sm:max-w-6xl p-0 overflow-hidden max-sm:h-screen max-sm:w-full"
      >
        <div className="sticky max-sm:top-5 z-10 bg-background px-4 py-3 border-b flex justify-between h-20">
          <div className="relative flex items-center sm:w-[95%]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search music..."
              className="pl-9 pr-10 border-none bg-secondary/40 focus:bg-secondary/60 rounded-full focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground 
                         hover:text-primary transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full absolute top-5 right-2"
            onClick={handleClose}
          >
            <X className="w-12 h-12" />
          </Button>
        </div>

        <ScrollArea className="sm:h-[70vh]">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : searchResults?.songs?.length > 0 ? (
              <div className="space-y-6">
                <section className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium">Songs</h2>
                    <span className="text-sm text-muted-foreground">
                      {searchResults.count} found
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.songs.map((song, index) => (
                      <div key={song?.id || index}>
                        <SongCard song={song} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : debouncedQuery ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-[50vh]">
                <Search className="w-16 h-16 mb-6" />
                <p className="text-lg font-medium mb-2">No songs found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-[50vh]">
                <Search className="w-16 h-16 mb-6 animate-pulse" />
                <p className="text-lg font-medium mb-2">Start typing to search</p>
                <p className="text-sm">Find your favorite songs</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default SearchDialog
