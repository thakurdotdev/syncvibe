import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ListMusic, Play, Sparkles, Trash2 } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { motion } from "framer-motion"

const SortableQueueItem = memo(
  ({ item, isPlaying, onRemove, onFetchRecs }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isItemDragging,
    } = useSortable({ id: item.id, disabled: isPlaying })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isItemDragging ? 0.5 : 1,
      zIndex: isItemDragging ? 50 : "auto",
    }

    const handleRemove = useCallback(() => onRemove(item.id), [item.id, onRemove])
    const handleRecs = useCallback(() => onFetchRecs?.(item.song?.id), [item.song?.id, onFetchRecs])

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 p-2 rounded-xl transition-colors w-full overflow-hidden",
          isPlaying
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-accent/50 border border-transparent",
          isItemDragging && "shadow-lg bg-accent",
        )}
      >
        {!isPlaying ? (
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded hover:bg-accent cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="w-6 shrink-0 text-center">
            <div className="flex items-center justify-center gap-0.5 h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 bg-primary rounded-full animate-wave"
                  style={{ animationDelay: `${i * 0.15}s`, height: "100%", transformOrigin: "bottom" }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
          <img
            src={item.song?.image?.[1]?.link}
            alt={item.song?.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate text-sm", isPlaying && "text-primary")}>
            {item.song?.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {item.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
          </p>
        </div>

        <Avatar className="h-5 w-5 shrink-0">
          <AvatarImage src={item.addedBy?.profilePic} />
          <AvatarFallback className="text-[10px]">
            {item.addedBy?.userName?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {!isPlaying && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRecs}
              className="h-7 w-7 text-muted-foreground hover:text-primary cursor-pointer"
              title="Get recommendations"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  },
)

const DragOverlayItem = memo(({ item }) => (
  <div className="flex items-center gap-2 p-2 rounded-xl bg-accent border border-border shadow-xl w-full max-w-md">
    <div className="p-1 shrink-0">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
      <img
        src={item?.song?.image?.[1]?.link}
        alt={item?.song?.name}
        className="h-full w-full object-cover"
      />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate text-sm">{item?.song?.name}</p>
      <p className="text-xs text-muted-foreground truncate">
        {item?.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
      </p>
    </div>
  </div>
))

const EmptyQueue = memo(() => (
  <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
    <div className="p-4 rounded-full bg-primary/10">
      <ListMusic className="h-10 w-10 text-primary/50" />
    </div>
    <div>
      <p className="font-medium text-lg">Queue is empty</p>
      <p className="text-muted-foreground text-sm mt-1">Search for songs above to get started</p>
    </div>
  </div>
))

const QueueList = memo(({
  queue,
  currentQueueIndex,
  currentQueueItem,
  upcomingQueue,
  removeFromQueue,
  reorderQueue,
  onFetchRecs,
  user,
  currentGroup,
  children,
}) => {
  const [activeId, setActiveId] = useState(null)

  const isCreator = useMemo(
    () => currentGroup?.createdBy === user?.userid,
    [currentGroup?.createdBy, user?.userid],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const upcomingIds = useMemo(() => upcomingQueue.map((item) => item.id), [upcomingQueue])
  const activeItem = useMemo(() => queue.find((item) => item.id === activeId), [queue, activeId])

  const handleDragStart = useCallback((event) => setActiveId(event.active.id), [])
  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveId(null)
      if (over && active.id !== over.id) {
        const oldIndex = queue.findIndex((item) => item.id === active.id)
        const newIndex = queue.findIndex((item) => item.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) reorderQueue(oldIndex, newIndex)
      }
    },
    [queue, reorderQueue],
  )
  const handleDragCancel = useCallback(() => setActiveId(null), [])

  if (queue.length === 0) return <EmptyQueue />

  return (
    <motion.div
      key="queue"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="p-3 space-y-3">
        {currentQueueItem && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
              Now Playing
            </p>
            <SortableQueueItem
              item={currentQueueItem}
              isPlaying={true}
              onRemove={removeFromQueue}
              onFetchRecs={onFetchRecs}
            />
          </div>
        )}

        {upcomingQueue.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
              Up Next ({upcomingQueue.length}) — Drag to reorder
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={upcomingIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {upcomingQueue.map((item) => (
                    <SortableQueueItem
                      key={item.id}
                      item={item}
                      isPlaying={false}
                      onRemove={removeFromQueue}
                      onFetchRecs={onFetchRecs}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeId ? <DragOverlayItem item={activeItem} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {children}
      </div>
    </motion.div>
  )
})

export default QueueList
