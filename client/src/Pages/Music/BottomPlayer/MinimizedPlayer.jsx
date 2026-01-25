import { memo, useEffect, useState } from "react"
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"
import DraggableButton from "./DraggableButton"

const BUTTON_SIZE = 56

const MinimizedPlayer = memo(({ isMinimized, onMaximize, currentSong, isMobile }) => {
  const [position, setPosition] = useState({
    x: isMobile ? window.innerWidth - 180 : 23,
    y: isMobile ? window.innerHeight - 100 : window.innerHeight - 120,
  })
  const [isDragging, setIsDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
  )

  useEffect(() => {
    const handleResize = () => {
      setPosition((prevPos) => ({
        x: Math.min(prevPos.x, window.innerWidth - BUTTON_SIZE),
        y: Math.min(prevPos.y, window.innerHeight - BUTTON_SIZE),
      }))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = (event) => {
    const { delta } = event

    if (delta) {
      setPosition((prev) => ({
        x: Math.min(Math.max(0, prev.x + delta.x), window.innerWidth - BUTTON_SIZE),
        y: Math.min(Math.max(0, prev.y + delta.y), window.innerHeight - BUTTON_SIZE),
      }))
    }

    setIsDragging(false)
  }

  if (!isMinimized) return null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <DraggableButton
        position={position}
        onMaximize={onMaximize}
        currentSong={currentSong}
        isDragging={isDragging}
      />
    </DndContext>
  )
})

MinimizedPlayer.displayName = "MinimizedPlayer"
export default MinimizedPlayer
