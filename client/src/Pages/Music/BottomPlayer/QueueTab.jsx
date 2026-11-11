/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence } from 'framer-motion';
import he from 'he';
import {
  ArrowDownToLine,
  Trash2,
  Disc3,
  GripVertical,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';
import { usePlayerSessionStore } from '@/stores/playerSessionStore';

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

/** How far a row must travel, at most, before letting go removes it. */
const SWIPE_REMOVE_PX = 120;
/** Movement before deciding whether a touch is a swipe or a scroll. */
const SWIPE_DECIDE_PX = 10;

/**
 * Swipe a row left to remove it, on touch screens, like the app's queue. Only sideways moves
 * count: the row allows vertical panning, so scrolling the list stays the browser's own.
 */
const useSwipeToRemove = (onSwipe, enabled) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const swiped = useRef(false);

  const end = (commit) => {
    const current = gesture.current;
    gesture.current = null;
    setDragging(false);
    if (
      commit &&
      current?.swiping &&
      current.dx <= -Math.min(SWIPE_REMOVE_PX, current.width * 0.35)
    ) {
      setOffset(-current.width);
      setTimeout(onSwipe, 160);
      // Shared queues remove it when the server answers; if it never goes, bring it back.
      setTimeout(() => setOffset(0), 2000);
      return;
    }
    setOffset(0);
  };

  return {
    offset,
    dragging,
    handlers: enabled
      ? {
          onPointerDown: (e) => {
            if (e.pointerType !== 'touch') return;
            swiped.current = false;
            gesture.current = {
              x: e.clientX,
              y: e.clientY,
              dx: 0,
              width: e.currentTarget.offsetWidth,
              swiping: false,
            };
          },
          onPointerMove: (e) => {
            const current = gesture.current;
            if (!current) return;
            const dx = e.clientX - current.x;
            const dy = e.clientY - current.y;
            if (!current.swiping) {
              if (Math.abs(dy) > SWIPE_DECIDE_PX && Math.abs(dy) > Math.abs(dx)) {
                gesture.current = null;
                return;
              }
              if (Math.abs(dx) < SWIPE_DECIDE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
              current.swiping = true;
              swiped.current = true;
              setDragging(true);
            }
            current.dx = Math.min(0, dx);
            setOffset(current.dx);
          },
          onPointerUp: () => end(true),
          onPointerCancel: () => end(false),
          // A swipe that ends over the row mustn't also count as a tap that plays the song.
          onClickCapture: (e) => {
            if (!swiped.current) return;
            swiped.current = false;
            e.stopPropagation();
            e.preventDefault();
          },
        }
      : {},
  };
};

// Minimal queue song item - matching SearchUser.jsx styling & instant smooth hover
const QueueSongItem = memo(
  ({
    song,
    isCurrentSong,
    isPlaying,
    isDragging,
    dragHandleProps,
    isOverlay,
    onPlay,
    onRemove,
    onRemoveBelow,
    isLast,
    onFetchRecommendations,
    isLoadingRecs,
    variant,
  }) => {
    const navigate = useNavigate();

    const name = useMemo(() => he.decode(song.name || song.title || ''), [song.name, song.title]);
    const artistName = useMemo(
      () =>
        song?.artist_map?.artists
          ?.slice(0, 2)
          ?.map((artist) => artist.name)
          .join(', ') || '',
      [song?.artist_map?.artists]
    );

    const songImage = useMemo(
      () =>
        Array.isArray(song.image) ? song.image?.[1]?.link || song.image?.[0]?.link : song.image,
      [song.image]
    );

    const handlePlay = useCallback(
      (e) => {
        e.stopPropagation();
        onPlay(song, isCurrentSong);
      },
      [onPlay, song, isCurrentSong]
    );

    const handleRemove = useCallback(
      (e) => {
        e.stopPropagation();
        onRemove(song.id, name, isCurrentSong);
      },
      [onRemove, song.id, name, isCurrentSong]
    );

    const handleGoToAlbum = useCallback(
      (e) => {
        e.stopPropagation();
        if (song?.album_id) {
          navigate(`/album/${song.album_id}`, { state: song.album_id });
        }
      },
      [song?.album_id, navigate]
    );

    const handleGoToArtist = useCallback(
      (e) => {
        e.stopPropagation();
        if (song?.artist_map?.primary_artists?.[0]?.id) {
          navigate(`/artist/${song.artist_map.primary_artists[0].id}`, {
            state: song.artist_map.primary_artists[0].id,
          });
        }
      },
      [song?.artist_map?.primary_artists, navigate]
    );

    const handleFetchRecs = useCallback(
      (e) => {
        e.stopPropagation();
        onFetchRecommendations?.(song.id, song.name || song.title);
      },
      [onFetchRecommendations, song.id, song.name, song.title]
    );

    const swipe = useSwipeToRemove(
      () => onRemove(song.id, name, false),
      !isCurrentSong && !isOverlay
    );

    return (
      <div className='relative overflow-hidden rounded-md'>
        {swipe.offset < 0 && (
          <div
            aria-hidden='true'
            className='absolute inset-0 flex items-center justify-end gap-1.5 bg-destructive pr-4 text-sm font-medium text-destructive-foreground'
          >
            <Trash2 className='h-4 w-4' />
            Remove
          </div>
        )}
        <div
          role='button'
          tabIndex={0}
          onClick={handlePlay}
          {...swipe.handlers}
          style={{
            transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease-out',
            touchAction: 'pan-y',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePlay(e);
            }
          }}
          className={cn(
            'relative group flex items-center px-3 py-2 rounded-md cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring w-full',
            // Opaque while it moves, so the red underneath shows only where the row has left.
            swipe.offset < 0 && 'bg-background',
            isCurrentSong
              ? 'bg-accent/80 dark:bg-accent/60 text-accent-foreground font-medium'
              : 'hover:bg-muted/70 dark:hover:bg-muted/50 text-foreground',
            isDragging && 'opacity-30',
            isOverlay && 'bg-popover text-popover-foreground shadow-2xl border border-border'
          )}
        >
          <div
            {...dragHandleProps}
            className='cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-foreground touch-none shrink-0 mr-1.5'
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className='w-3.5 h-3.5' />
          </div>

          <Avatar className='relative shrink-0 w-10 h-10 rounded-md ring-1 ring-border/40 group-hover:ring-border/80 overflow-hidden'>
            <AvatarImage src={songImage} alt={name} className='w-10 h-10 object-cover rounded-md' />
            <AvatarFallback className='w-10 h-10 rounded-md text-xs bg-muted'>
              <Music className='w-4 h-4 text-muted-foreground' />
            </AvatarFallback>
            {isCurrentSong && (
              <div className='absolute inset-0 bg-background/60 flex items-center justify-center'>
                {isPlaying ? (
                  <Pause className='w-3.5 h-3.5 text-foreground fill-current' />
                ) : (
                  <Play className='w-3.5 h-3.5 text-foreground fill-current ml-0.5' />
                )}
              </div>
            )}
          </Avatar>

          <div className='flex flex-col ml-3 flex-1 min-w-0'>
            <div className='flex items-center justify-between gap-1.5'>
              <span
                className={cn(
                  'text-sm truncate',
                  isCurrentSong
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-foreground/90 group-hover:text-foreground'
                )}
              >
                {name}
              </span>
            </div>

            <p className='text-xs text-muted-foreground group-hover:text-foreground/75 truncate mt-0.5'>
              {artistName || 'Unknown Artist'}
            </p>
          </div>

          {isCurrentSong && isPlaying && (
            <div className='flex items-center gap-[2px] px-1.5 py-1 rounded-sm bg-primary/15 shrink-0 mx-1'>
              <span className='w-[2px] h-2.5 rounded-full bg-primary animate-pulse' />
              <span
                className='w-[2px] h-3.5 rounded-full bg-primary animate-pulse'
                style={{ animationDelay: '150ms' }}
              />
              <span
                className='w-[2px] h-2 rounded-full bg-primary animate-pulse'
                style={{ animationDelay: '300ms' }}
              />
            </div>
          )}

          {!isCurrentSong && (
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md cursor-pointer shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 ml-1'
              onClick={handleRemove}
              aria-label='Remove song'
            >
              <X className='w-3.5 h-3.5' />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'
                onClick={(e) => e.stopPropagation()}
                aria-label='More options'
              >
                <MoreHorizontal className='w-3.5 h-3.5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              className='w-52 bg-popover text-popover-foreground border-border shadow-xl rounded-lg p-1.5 z-50'
            >
              <DropdownMenuItem
                onClick={handleFetchRecs}
                disabled={isLoadingRecs}
                className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md'
              >
                {isLoadingRecs ? (
                  <Loader2 className='w-3.5 h-3.5 mr-2 animate-spin' />
                ) : (
                  <Sparkles className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                )}
                Get similar songs
              </DropdownMenuItem>
              <DropdownMenuSeparator className='bg-border my-1' />
              {song?.album_id && (
                <DropdownMenuItem
                  onClick={handleGoToAlbum}
                  className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md'
                >
                  <Disc3 className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                  Go to Album
                </DropdownMenuItem>
              )}
              {song?.artist_map?.primary_artists?.[0] && (
                <DropdownMenuItem
                  onClick={handleGoToArtist}
                  className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md'
                >
                  <User className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                  Go to Artist
                </DropdownMenuItem>
              )}
              {(!isCurrentSong || !isLast) && <DropdownMenuSeparator className='bg-border my-1' />}
              {!isLast && onRemoveBelow && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBelow(song.id);
                  }}
                  className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md'
                >
                  <ArrowDownToLine className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                  Remove songs below
                </DropdownMenuItem>
              )}
              {!isCurrentSong && (
                <>
                  <DropdownMenuItem
                    onClick={handleRemove}
                    className='cursor-pointer text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive rounded-md'
                  >
                    <X className='w-3.5 h-3.5 mr-2' />
                    Remove
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }
);

QueueSongItem.displayName = 'QueueSongItem';

// Sortable wrapper
const SortableSongItem = memo(
  ({
    song,
    isCurrentSong,
    isPlaying,
    onPlay,
    onRemove,
    onRemoveBelow,
    isLast,
    onFetchRecommendations,
    isLoadingRecs,
    variant,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: song.id,
    });

    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      zIndex: isDragging ? 10 : 'auto',
      position: 'relative',
    };

    return (
      <div ref={setNodeRef} style={style}>
        <QueueSongItem
          song={song}
          isCurrentSong={isCurrentSong}
          isPlaying={isPlaying}
          isDragging={isDragging}
          dragHandleProps={{ ...attributes, ...listeners }}
          onPlay={onPlay}
          onRemove={onRemove}
          onRemoveBelow={onRemoveBelow}
          isLast={isLast}
          onFetchRecommendations={onFetchRecommendations}
          isLoadingRecs={isLoadingRecs}
          variant={variant}
        />
      </div>
    );
  }
);

SortableSongItem.displayName = 'SortableSongItem';

// Main QueueTab
const QueueTab = memo(({ variant } = {}) => {
  const playlist = usePlayerStore((s) => s.playlist);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const currentSongId = currentSong?.id;
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);

  const [activeId, setActiveId] = useState(null);
  const [loadingSongId, setLoadingSongId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handlePlay = useCallback((song, isCurrentSong) => {
    if (isCurrentSong) {
      usePlayerStore.getState().handlePlayPause();
    } else {
      usePlayerStore.getState().playSong(song);
    }
  }, []);

  const handleRemove = useCallback((songId, name, isCurrentSong) => {
    if (isCurrentSong) {
      toast.error('Cannot remove currently playing song');
      return;
    }
    const currentList = usePlayerStore.getState().playlist;
    usePlayerStore.getState().setPlaylist(currentList.filter((item) => item.id !== songId));
    // Undo only on this device's own queue: a shared one may have changed elsewhere since.
    const shared = usePlayerSessionStore.getState().live;
    toast.success(`Removed "${name}"`, {
      action: shared
        ? undefined
        : { label: 'Undo', onClick: () => usePlayerStore.getState().setPlaylist(currentList) },
    });
  }, []);

  const handleRemoveBelow = useCallback((songId) => {
    usePlayerStore.getState().removeFromQueueBelow(songId);
    toast.success('Removed the songs below');
  }, []);

  const handleSongFetchRecs = useCallback(async (songId) => {
    if (!songId) return;
    setLoadingSongId(songId);
    try {
      const { fetchSongRecommendations } = await import('@/api/music/songs');
      const data = await fetchSongRecommendations(songId);
      if (data?.length > 0) {
        usePlayerStore.getState().addToQueue(data);
        toast.success(`Added ${data.length} similar songs`);
      } else {
        toast.info('No similar songs found');
      }
    } catch {
      toast.error('Failed to fetch recommendations');
    }
    setLoadingSongId(null);
  }, []);

  const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);
      if (active.id !== over?.id) {
        const currentList = usePlayerStore.getState().playlist;
        const oldIndex = currentList.findIndex((s) => s.id === active.id);
        const newIndex = currentList.findIndex((s) => s.id === over?.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          setPlaylist(arrayMove(currentList, oldIndex, newIndex));
        }
      }
    },
    [setPlaylist]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const activeSong = useMemo(
    () => (activeId ? playlist.find((s) => s.id === activeId) : null),
    [activeId, playlist]
  );

  const playlistIds = useMemo(() => playlist.map((s) => s.id), [playlist]);

  if (!playlist?.length) {
    return (
      <div className='flex flex-col justify-center items-center h-[70vh] gap-3 text-muted-foreground'>
        <ListMusic className='w-10 h-10 opacity-40' />
        <p className='text-sm font-medium'>Queue is empty</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className='h-full'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={playlistIds} strategy={verticalListSortingStrategy}>
            <div className='space-y-0.5 p-1.5'>
              {playlist.map((song, index) => (
                <SortableSongItem
                  key={song.id}
                  isLast={index === playlist.length - 1}
                  onRemoveBelow={handleRemoveBelow}
                  song={song}
                  isCurrentSong={currentSongId === song.id}
                  isPlaying={isPlaying}
                  onPlay={handlePlay}
                  onRemove={handleRemove}
                  onFetchRecommendations={handleSongFetchRecs}
                  isLoadingRecs={loadingSongId === song.id}
                  variant={variant}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay
            dropAnimation={{
              duration: 150,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeSong && (
              <div className='pointer-events-none'>
                <QueueSongItem
                  song={activeSong}
                  isCurrentSong={currentSongId === activeSong.id}
                  isPlaying={isPlaying}
                  isOverlay
                  onPlay={handlePlay}
                  onRemove={handleRemove}
                  onFetchRecommendations={handleSongFetchRecs}
                  isLoadingRecs={loadingSongId === activeSong.id}
                  variant={variant}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </TooltipProvider>
  );
});

QueueTab.displayName = 'QueueTab';
export { QueueTab };
export default QueueTab;
