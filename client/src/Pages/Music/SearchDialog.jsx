import { createPortal } from "react-dom"
import { Loader2, Search, X, XCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useBackendSearchQuery } from "@/hooks/queries/useSongQueries"
import { SongCard } from "./Cards"
import { AnimatePresence, motion } from "framer-motion"
import "./music.css"

const SearchDialog = ({ open, setOpen }) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const inputRef = useRef(null)
  const overlayRef = useRef(null)

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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, handleClose])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      handleClose()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="search-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            className="search-dialog-container"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-dialog-header">
              <div className="search-dialog-input-wrap">
                <Search className="search-dialog-input-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search songs, artists..."
                  className="search-dialog-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      inputRef.current?.focus()
                    }}
                    className="search-dialog-clear"
                    type="button"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="search-dialog-close"
                onClick={handleClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <ScrollArea className="search-dialog-body">
              <div className="p-4 sm:p-5">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="search-dialog-loader">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground mt-3">Searching...</span>
                    </div>
                  </div>
                ) : searchResults?.songs?.length > 0 ? (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold">Songs</h2>
                      <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                        {searchResults.count} found
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {searchResults.songs.map((song, index) => (
                        <div key={song?.id || index}>
                          <SongCard song={song} />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : debouncedQuery ? (
                  <div className="search-dialog-empty">
                    <div className="search-dialog-empty-icon">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="text-base font-medium mb-1">No songs found</p>
                    <p className="text-sm text-muted-foreground">Try a different search term</p>
                  </div>
                ) : (
                  <div className="search-dialog-empty">
                    <div className="search-dialog-empty-icon pulse">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="text-base font-medium mb-1">Start typing to search</p>
                    <p className="text-sm text-muted-foreground">Find your favorite songs & albums</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default SearchDialog
