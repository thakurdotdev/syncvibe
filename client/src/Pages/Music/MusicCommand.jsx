import { Input } from "@/components/ui/input"
import { Command, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import SearchDialog from "./SearchDialog"

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

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div
        onClick={toggleOpen}
        className="relative h-10 flex items-center group"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            toggleOpen()
          }
        }}
      >
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 
                          text-muted-foreground group-hover:text-primary 
                          transition-colors duration-200"
        />

        <Input
          readOnly
          className="w-full pl-9 pr-12 h-full cursor-pointer select-none 
                     rounded-full bg-secondary/40 hover:bg-secondary/60
                     transition-all duration-200 border-none shadow-xs
                     focus:ring-0 focus:ring-offset-0 group-hover:shadow-md focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        <span
          className="absolute left-9 top-1/2 -translate-y-1/2 
                       text-muted-foreground pointer-events-none
                       group-hover:text-primary transition-colors duration-200"
        >
          Search music...
        </span>

        <kbd
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-5 select-none items-center gap-1 
                       rounded border bg-background px-1.5 
                       font-mono text-[10px] font-medium text-muted-foreground
                       group-hover:border-primary group-hover:text-primary
                       transition-colors duration-200"
        >
          <Command className="h-3 w-3" />K
        </kbd>
      </div>

      <SearchDialog open={open} setOpen={setOpen} />
    </div>
  )
}

export default MusicCommand
