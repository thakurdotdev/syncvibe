import { memo, useMemo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { Card } from "@/components/ui/card"
import { PlayIcon } from "lucide-react"
import { usePlayerStore } from "@/stores/playerStore"
import { AudioWave } from "../Cards"
import he from "he"

const DraggableButton = memo(({ position, onMaximize, currentSong, isDragging }) => {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "minimized-player",
  })

  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png",
    [currentSong],
  )

  const style = {
    position: "fixed",
    top: position.y,
    left: position.x,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    touchAction: "none",
  }

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onMaximize()}
      style={style}
      className="flex items-center gap-1 px-2 py-1 rounded-full shadow-md cursor-pointer select-none z-[9999]"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden">
        <img src={songImage} alt="" className="w-full h-full object-cover" />
      </div>
      {isPlaying ? <AudioWave /> : <PlayIcon size={20} />}
      <span className="hidden sm:block text-sm max-w-[100px] truncate">
        {he.decode(currentSong?.name || "")}
      </span>
    </Card>
  )
})

DraggableButton.displayName = "DraggableButton"
export default DraggableButton
