import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useGroupMusic } from "@/Context/GroupMusicContext"
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
import { GripVertical, ListMusic, Play, SkipForward, Trash2, X } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"

// Sortable Queue Item
const SortableQueueItem = memo(
  ({ item, index, isPlaying, isCurrentUser, isCreator, onRemove, isDragging }) => {
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

    const handleRemove = useCallback(() => {
      onRemove(item.id)
    }, [item.id, onRemove])

    const canDrag = !isPlaying

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 p-2 rounded-xl transition-colors w-full",
          isPlaying
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-accent/50 border border-transparent",
          isItemDragging && "shadow-lg bg-accent",
        )}
      >
        {/* Drag Handle */}
        {canDrag ? (
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

        {/* Album Art */}
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

        {/* Song Info */}
        <div className="flex-1 min-w-0 max-w-[240px]">
          <p className={cn("font-medium truncate text-sm", isPlaying && "text-primary")}>
            {item.song?.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {item.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
          </p>
        </div>

        {/* Added By */}
        <div className="flex items-center gap-1 shrink-0">
          <Avatar className="h-5 w-5">
            <AvatarImage src={item.addedBy?.profilePic} />
            <AvatarFallback className="text-[10px]">
              {item.addedBy?.userName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Remove Button */}
        {!isPlaying && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  },
)

// Drag Overlay Item (visual during drag)
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
    <div className="flex-1 min-w-0 max-w-[280px]">
      <p className="font-medium truncate text-sm">{item?.song?.name}</p>
      <p className="text-xs text-muted-foreground truncate">
        {item?.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
      </p>
    </div>
  </div>
))

// Empty Queue State
const EmptyQueue = memo(() => (
  <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
    <div className="p-4 rounded-full bg-primary/10">
      <ListMusic className="h-10 w-10 text-primary/50" />
    </div>
    <div>
      <p className="font-medium text-lg">Queue is empty</p>
      <p className="text-muted-foreground text-sm mt-1">
        Search for songs and add them to the queue
      </p>
    </div>
  </div>
))

// Main QueueSheet Component
const QueueSheet = () => {
  const {
    isQueueOpen,
    setIsQueueOpen,
    queue,
    currentQueueIndex,
    currentQueueItem,
    upcomingQueue,
    removeFromQueue,
    reorderQueue,
    skipSong,
    currentGroup,
  } = useGroupMusic()
  const { user } = useGroupMusic()

  const [activeId, setActiveId] = useState(null)

  const isCreator = useMemo(
    () => currentGroup?.createdBy === user?.userid,
    [currentGroup?.createdBy, user?.userid],
  )

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Get item IDs for sortable context (only upcoming items)
  const upcomingIds = useMemo(() => upcomingQueue.map((item) => item.id), [upcomingQueue])

  const activeItem = useMemo(() => queue.find((item) => item.id === activeId), [queue, activeId])

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveId(null)

      if (over && active.id !== over.id) {
        const oldIndex = queue.findIndex((item) => item.id === active.id)
        const newIndex = queue.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderQueue(oldIndex, newIndex)
        }
      }
    },
    [queue, reorderQueue],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  return (
    <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ListMusic className="h-4 w-4 text-primary" />
              </div>
              <SheetTitle className="text-lg">Queue</SheetTitle>
              {queue.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {queue.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentQueueItem && upcomingQueue.length > 0 && (
                <Button variant="outline" size="sm" onClick={skipSong} className="gap-1.5">
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsQueueOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">View and manage the music queue</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          {queue.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="p-3 space-y-3 overflow-hidden">
              {/* Now Playing Section */}
              {currentQueueItem && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
                    Now Playing
                  </p>
                  <SortableQueueItem
                    item={currentQueueItem}
                    index={currentQueueIndex}
                    isPlaying={true}
                    isCurrentUser={currentQueueItem.addedBy?.userId === user?.userid}
                    isCreator={isCreator}
                    onRemove={removeFromQueue}
                  />
                </div>
              )}

              {/* Up Next Section with Drag & Drop */}
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
                        {upcomingQueue.map((item, idx) => (
                          <SortableQueueItem
                            key={item.id}
                            item={item}
                            index={currentQueueIndex + 1 + idx}
                            isPlaying={false}
                            isCurrentUser={item.addedBy?.userId === user?.userid}
                            isCreator={isCreator}
                            onRemove={removeFromQueue}
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
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export default memo(QueueSheet)
