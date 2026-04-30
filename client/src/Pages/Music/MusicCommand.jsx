import { Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import SearchDialog from "./SearchDialog"
import "./music.css"

const MusicCommand = () => {
  const [open, setOpen] = useState(false)

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleOpen()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [toggleOpen])

  const isMac = navigator.userAgent.includes("Mac")

  return (
    <>
      <button
        onClick={toggleOpen}
        className="music-search-trigger"
        type="button"
      >
        <Search className="music-search-icon" />
        <span className="music-search-placeholder">
          <span className="hidden sm:inline">Search songs, artists, albums...</span>
          <span className="sm:hidden">Search songs...</span>
        </span>
        <kbd className="music-search-kbd">
          <span className="music-search-kbd-key">{isMac ? "⌘" : "Ctrl"}</span>
          <span className="music-search-kbd-key">K</span>
        </kbd>
      </button>

      <SearchDialog open={open} setOpen={setOpen} />
    </>
  )
}

export default MusicCommand
