import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Bookmark, GripVertical, ListMusic, Play, Sparkles, Trash2 } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

const SortableQueueItem = memo(({ item, isPlaying, onRemove, onFetchRecs, onSaveToPlaylist }) => {
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
  const handleSave = useCallback(() => onSaveToPlaylist?.(item.song), [item.song, onSaveToPlaylist])

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "flex items-center gap-2.5 p-2 rounded-xl transition-colors duration-200 w-full overflow-hidden group",
        isPlaying ? "liquid-panel border-primary/15" : "liquid-hover-row border border-transparent",
        isItemDragging && "liquid-panel-elevated",
      )}
    >
      {!isPlaying ? (
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded-lg hover:bg-accent/50 cursor-grab active:cursor-grabbing touch-none opacity-30 hover:opacity-80 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="w-6 shrink-0 text-center">
          <div className="flex items-center justify-center gap-[3px] h-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[3px] bg-primary rounded-full animate-wave"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  height: "100%",
                  transformOrigin: "bottom",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="relative h-10 w-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/30">
        <img
          src={item.song?.image?.[1]?.link}
          alt={item.song?.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {isPlaying && (
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px] flex items-center justify-center">
            <Play className="h-3.5 w-3.5 text-white fill-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("font-medium truncate text-sm", isPlaying && "text-primary")}>
          {item.song?.name}
        </p>
        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {item.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
        </p>
      </div>

      <Avatar className="h-5 w-5 shrink-0 ring-1 ring-border/30">
        <AvatarImage src={item.addedBy?.profilePic} />
        <AvatarFallback className="text-[10px] bg-accent">
          {item.addedBy?.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex items-center gap-0.5 shrink-0">
        {onSaveToPlaylist && (
          <button
            onClick={handleSave}
            className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-accent/50 cursor-pointer transition-all duration-200"
            title="Save to playlist"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
        )}
        {!isPlaying && (
          <>
            <button
              onClick={handleRecs}
              className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-accent/50 cursor-pointer transition-all duration-200"
              title="Get recommendations"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRemove}
              className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-all duration-200"
              title="Remove from queue"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
})

const DragOverlayItem = memo(({ item }) => (
  <div
    className="flex items-center gap-2.5 p-2 rounded-xl liquid-panel-elevated w-full max-w-md"
    style={{ willChange: "transform" }}
  >
    <div className="p-1 shrink-0">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/30">
      <img
        src={item?.song?.image?.[1]?.link}
        alt={item?.song?.name}
        className="h-full w-full object-cover"
      />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate text-sm">{item?.song?.name}</p>
      <p className="text-xs text-muted-foreground/50 truncate">
        {item?.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
      </p>
    </div>
  </div>
))

const EmptyQueue = memo(() => (
  <div className="flex flex-col items-center justify-center h-72 gap-5 text-center px-4">
    <div className="relative">
      <motion.div
        animate={{ scale: [1, 1.4], opacity: [0.15, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="absolute inset-0 rounded-full border border-border/30"
        style={{ margin: "-12px" }}
      />
      <motion.div
        animate={{ scale: [1, 1.7], opacity: [0.1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        className="absolute inset-0 rounded-full border border-border/20"
        style={{ margin: "-12px" }}
      />
      <div className="p-5 rounded-full liquid-badge relative">
        <ListMusic className="h-10 w-10 text-muted-foreground/25" />
      </div>
    </div>
    <div className="space-y-1.5">
      <p className="font-semibold text-lg">Queue is empty</p>
      <p className="text-muted-foreground/60 text-sm">Search for songs above to get started</p>
    </div>
  </div>
))

const QueueList = memo(
  ({
    queue,
    currentQueueIndex,
    currentQueueItem,
    upcomingQueue,
    removeFromQueue,
    reorderQueue,
    onFetchRecs,
    onSaveToPlaylist,
    user,
    currentGroup,
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
        <div className="p-3 space-y-4">
          {currentQueueItem && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 mb-2">
                Now Playing
              </p>
              <SortableQueueItem
                item={currentQueueItem}
                isPlaying={true}
                onRemove={removeFromQueue}
                onFetchRecs={onFetchRecs}
                onSaveToPlaylist={onSaveToPlaylist}
              />
            </div>
          )}

          {upcomingQueue.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 mb-2">
                Up Next ({upcomingQueue.length})
                <span className="normal-case tracking-normal text-muted-foreground/40 ml-1.5 font-normal">
                  — Drag to reorder
                </span>
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={upcomingIds} strategy={verticalListSortingStrategy}>
                  <AnimatePresence initial={false}>
                    <div className="space-y-1">
                      {upcomingQueue.map((item) => (
                        <SortableQueueItem
                          key={item.id}
                          item={item}
                          isPlaying={false}
                          onRemove={removeFromQueue}
                          onFetchRecs={onFetchRecs}
                          onSaveToPlaylist={onSaveToPlaylist}
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                </SortableContext>
                <DragOverlay>{activeId ? <DragOverlayItem item={activeItem} /> : null}</DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </motion.div>
    )
  },
)

export default QueueList
