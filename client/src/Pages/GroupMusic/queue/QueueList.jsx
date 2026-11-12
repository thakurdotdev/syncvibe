import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bookmark, GripVertical, ListMusic, Play, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

// Rows only move up and down.
const lockToVerticalAxis = ({ transform }) => ({ ...transform, x: 0 });

const SortableQueueItem = memo(
  ({
    item,
    isPlaying,
    canReorder = true,
    canRemove = false,
    onRemove,
    onPlayItem,
    onFetchRecs,
    onSaveToPlaylist,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isItemDragging,
    } = useSortable({ id: item.id, disabled: isPlaying || !canReorder });
    const handlePlay = useCallback(() => onPlayItem?.(item.id), [item.id, onPlayItem]);

    // The overlay follows the pointer; the row itself stays behind as a faint placeholder.
    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isItemDragging ? 0.35 : 1,
    };

    const handleRemove = useCallback(() => onRemove(item.id), [item.id, onRemove]);
    const handleRecs = useCallback(
      () => onFetchRecs?.(item.song?.id),
      [item.song?.id, onFetchRecs]
    );
    const handleSave = useCallback(
      () => onSaveToPlaylist?.(item.song),
      [item.song, onSaveToPlaylist]
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-2.5 p-2 rounded-xl transition-colors duration-200 w-full overflow-hidden group',
          isPlaying
            ? 'liquid-panel border-primary/15'
            : 'liquid-hover-row border border-transparent'
        )}
      >
        {isPlaying ? null : canReorder ? (
          <button
            {...attributes}
            {...listeners}
            aria-label='Drag to reorder'
            className='p-1 rounded-lg hover:bg-accent/50 cursor-grab active:cursor-grabbing touch-none opacity-30 hover:opacity-80 transition-opacity'
          >
            <GripVertical className='h-4 w-4 text-muted-foreground' />
          </button>
        ) : null}
        {isPlaying && (
          <div className='w-6 shrink-0 text-center'>
            <div className='flex items-center justify-center gap-[3px] h-4'>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className='w-[3px] bg-primary rounded-full animate-wave'
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    height: '100%',
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className='relative h-10 w-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/30'>
          <img
            src={item.song?.image?.[1]?.link}
            alt={item.song?.name}
            className='h-full w-full object-cover'
            loading='lazy'
          />
          {isPlaying && (
            <div className='absolute inset-0 bg-scrim/25 backdrop-blur-[1px] flex items-center justify-center'>
              <Play className='h-3.5 w-3.5 text-on-scrim fill-on-scrim' />
            </div>
          )}
          {!isPlaying && onPlayItem && (
            <button
              type='button'
              onClick={handlePlay}
              aria-label={`Play ${item.song?.name} now`}
              title='Play now'
              className='absolute inset-0 flex cursor-pointer items-center justify-center bg-scrim/45 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100'
            >
              <Play className='h-3.5 w-3.5 text-on-scrim fill-on-scrim' />
            </button>
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5'>
            <p className={cn('font-medium truncate text-sm', isPlaying && 'text-primary')}>
              {item.song?.name}
            </p>
            {(item.isAutoRecommended || item.addedBy?.userId === 'system') && (
              <span className='inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md shrink-0'>
                <Sparkles className='h-2.5 w-2.5' /> Auto
              </span>
            )}
          </div>
          <p className='text-xs text-muted-foreground/70 truncate mt-0.5'>
            {item.song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist'}
          </p>
        </div>

        <Avatar className='h-5 w-5 shrink-0 ring-1 ring-border/30'>
          <AvatarImage src={item.addedBy?.profilePic} />
          <AvatarFallback className='text-[10px] bg-accent'>
            {item.addedBy?.userName?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className='flex items-center gap-0.5 shrink-0'>
          {onSaveToPlaylist && (
            <button
              onClick={handleSave}
              className='h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-accent/50 cursor-pointer transition-all duration-200'
              title='Save to playlist'
            >
              <Bookmark className='h-3.5 w-3.5' />
            </button>
          )}
          {!isPlaying && (
            <>
              <button
                onClick={handleRecs}
                className='h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-accent/50 cursor-pointer transition-all duration-200'
                title='Get recommendations'
              >
                <Sparkles className='h-3.5 w-3.5' />
              </button>
              {canRemove && (
                <button
                  onClick={handleRemove}
                  className='h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-all duration-200'
                  title='Remove from queue'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

const DragOverlayItem = memo(({ item }) => (
  <div className='flex items-center gap-2.5 p-2 rounded-xl liquid-panel-elevated w-full cursor-grabbing'>
    <div className='p-1 shrink-0'>
      <GripVertical className='h-4 w-4 text-muted-foreground' />
    </div>
    <div className='h-10 w-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/30'>
      <img
        src={item?.song?.image?.[1]?.link}
        alt={item?.song?.name}
        className='h-full w-full object-cover'
      />
    </div>
    <div className='flex-1 min-w-0'>
      <p className='font-medium truncate text-sm'>{item?.song?.name}</p>
      <p className='text-xs text-muted-foreground/50 truncate'>
        {item?.song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist'}
      </p>
    </div>
  </div>
));

const EmptyQueue = memo(({ title, description }) => (
  <div className='flex flex-col items-center justify-center gap-3 px-4 py-12 text-center'>
    <div className='rounded-2xl bg-foreground/[0.04] p-4'>
      <ListMusic className='h-6 w-6 text-muted-foreground/50' />
    </div>
    <div className='space-y-1'>
      <p className='text-sm font-semibold'>{title}</p>
      <p className='text-xs text-muted-foreground'>{description}</p>
    </div>
  </div>
));

const QueueList = memo(
  ({
    queue,
    currentQueueItem,
    upcomingQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    shuffleQueue,
    onPlayItem,
    canReorder = true,
    canRemoveItem,
    toggleAutoRecommendations,
    autoPlayRecommendations = true,
    onFetchRecs,
    onSaveToPlaylist,
    hideNowPlaying = false,
  }) => {
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const upcomingIds = useMemo(() => upcomingQueue.map((item) => item.id), [upcomingQueue]);
    const activeItem = useMemo(() => queue.find((item) => item.id === activeId), [queue, activeId]);

    const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);
    const handleDragEnd = useCallback(
      (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (over && active.id !== over.id) {
          const oldIndex = queue.findIndex((item) => item.id === active.id);
          const newIndex = queue.findIndex((item) => item.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1) reorderQueue(oldIndex, newIndex);
        }
      },
      [queue, reorderQueue]
    );
    const handleDragCancel = useCallback(() => setActiveId(null), []);

    if (queue.length === 0) {
      return (
        <EmptyQueue title='Queue is empty' description='Search above to add the first song.' />
      );
    }
    if (hideNowPlaying && upcomingQueue.length === 0) {
      return (
        <EmptyQueue
          title='Nothing up next'
          description={
            autoPlayRecommendations
              ? 'Autoplay will pick similar songs when this one ends.'
              : 'Search above to add songs for the group.'
          }
        />
      );
    }

    return (
      <motion.div
        key='queue'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className='p-3 space-y-4'>
          {currentQueueItem && !hideNowPlaying && (
            <div>
              <p className='text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 mb-2'>
                Now Playing
              </p>
              <SortableQueueItem
                item={currentQueueItem}
                isPlaying={true}
                onFetchRecs={onFetchRecs}
                onSaveToPlaylist={onSaveToPlaylist}
              />
            </div>
          )}

          {upcomingQueue.length > 0 && (
            <div>
              <div className='flex items-center justify-between px-2 mb-2'>
                <p className='text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest'>
                  Up Next ({upcomingQueue.length})
                  {canReorder && (
                    <span className='normal-case tracking-normal text-muted-foreground/40 ml-1.5 font-normal'>
                      — Drag to reorder
                    </span>
                  )}
                </p>
                <div className='flex items-center gap-2'>
                  {toggleAutoRecommendations && (
                    <button
                      onClick={() => toggleAutoRecommendations?.()}
                      className={cn(
                        'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer',
                        autoPlayRecommendations
                          ? 'text-primary bg-primary/10 border border-primary/20'
                          : 'text-muted-foreground/60 hover:text-foreground bg-accent/30'
                      )}
                      title='Toggle automatic recommendations'
                    >
                      <Sparkles className='h-3 w-3' />
                      <span>Autoplay {autoPlayRecommendations ? 'On' : 'Off'}</span>
                    </button>
                  )}
                  {shuffleQueue && upcomingQueue.length > 1 && (
                    <button
                      onClick={() => shuffleQueue()}
                      className='flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground px-2 py-0.5 rounded-full hover:bg-foreground/5 transition-colors cursor-pointer'
                      title='Shuffle upcoming songs'
                    >
                      <Shuffle className='h-3 w-3' />
                      <span>Shuffle</span>
                    </button>
                  )}
                  {clearQueue && (
                    <button
                      onClick={() => clearQueue?.()}
                      className='flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-destructive px-2 py-0.5 rounded-full hover:bg-destructive/10 transition-colors cursor-pointer'
                      title='Clear upcoming songs'
                    >
                      <Trash2 className='h-3 w-3' />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                modifiers={[lockToVerticalAxis]}
              >
                <SortableContext items={upcomingIds} strategy={verticalListSortingStrategy}>
                  <div className='space-y-1'>
                    {upcomingQueue.map((item) => (
                      <SortableQueueItem
                        key={item.id}
                        item={item}
                        isPlaying={false}
                        canReorder={canReorder}
                        canRemove={canRemoveItem ? canRemoveItem(item) : true}
                        onPlayItem={onPlayItem}
                        onRemove={removeFromQueue}
                        onFetchRecs={onFetchRecs}
                        onSaveToPlaylist={onSaveToPlaylist}
                      />
                    ))}
                  </div>
                </SortableContext>
                {/* The room panels use backdrop-filter, which would anchor the fixed overlay to the
                    panel instead of the viewport and leave it trailing the pointer. */}
                {createPortal(
                  <DragOverlay>
                    {activeId ? <DragOverlayItem item={activeItem} /> : null}
                  </DragOverlay>,
                  document.body
                )}
              </DndContext>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

export default QueueList;
