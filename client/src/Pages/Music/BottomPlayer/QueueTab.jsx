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
import { AnimatePresence, motion } from 'framer-motion';
import he from 'he';
import {
  Disc3,
  GripVertical,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import LazyImage from '@/components/LazyImage';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSongRecommendationsQuery } from '@/hooks/queries/useSongQueries';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';

const buttonVariants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
};

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

// Minimal queue song item - clean and lightweight
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
          navigate(`/music/album/${song.album_id}`, { state: song.album_id });
        }
      },
      [song?.album_id, navigate]
    );

    const handleGoToArtist = useCallback(
      (e) => {
        e.stopPropagation();
        if (song?.artist_map?.primary_artists?.[0]?.id) {
          navigate(`/music/artist/${song.artist_map.primary_artists[0].id}`, {
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

    return (
      <div
        className={cn(
          'group flex items-center gap-2.5 py-1.5 px-2 rounded-xl transition-colors duration-150 select-none cursor-pointer',
          isCurrentSong
            ? 'bg-white/10 ring-1 ring-white/15 shadow-sm my-0.5'
            : 'hover:bg-white/[0.05] my-0.5',
          isDragging && 'opacity-30',
          isOverlay && 'bg-[#141722]/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 text-white'
        )}
        onClick={handlePlay}
      >
        <div
          {...dragHandleProps}
          className='cursor-grab active:cursor-grabbing p-0.5 text-white/30 hover:text-white/70 touch-none transition-colors shrink-0'
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className='w-3.5 h-3.5' />
        </div>

        <div className='relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg overflow-hidden bg-white/5'>
          <LazyImage
            src={Array.isArray(song.image) ? song.image?.[1]?.link : song.image}
            alt={name}
            className='w-full h-full object-cover'
          />
          <div
            className='absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-150'
            style={{ opacity: isCurrentSong ? 1 : 0 }}
          >
            {isCurrentSong && isPlaying ? (
              <Pause className='w-3.5 h-3.5 text-white fill-white' />
            ) : (
              <Play className='w-3.5 h-3.5 text-white fill-white ml-0.5' />
            )}
          </div>
        </div>

        <div className='flex-1 min-w-0 text-left'>
          <p
            className={cn(
              'text-[13px] line-clamp-1 transition-colors leading-snug',
              isCurrentSong
                ? 'text-white font-semibold'
                : 'text-white/85 font-medium group-hover:text-white'
            )}
          >
            {name}
          </p>
          {artistName && (
            <p
              className={cn(
                'text-[11px] line-clamp-1 transition-colors leading-tight mt-0.5',
                isCurrentSong
                  ? 'text-white/60 font-normal'
                  : 'text-white/40 group-hover:text-white/60 font-normal'
              )}
            >
              {artistName}
            </p>
          )}
        </div>

        {isCurrentSong && isPlaying && (
          <div className='flex items-center gap-[2px] px-1.5 py-1 rounded-md bg-white/15 shrink-0 mr-0.5'>
            <span className='w-[2px] h-2.5 rounded-full bg-white animate-pulse' />
            <span
              className='w-[2px] h-3.5 rounded-full bg-white animate-pulse'
              style={{ animationDelay: '150ms' }}
            />
            <span
              className='w-[2px] h-2 rounded-full bg-white animate-pulse'
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}

        {!isCurrentSong && (
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-lg cursor-pointer transition-colors shrink-0'
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
              className='h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors shrink-0'
              onClick={(e) => e.stopPropagation()}
              aria-label='More options'
            >
              <MoreHorizontal className='w-3.5 h-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            className='w-52 bg-[#161822]/95 backdrop-blur-xl border-white/10 text-white shadow-2xl rounded-xl p-1.5 z-50'
          >
            <DropdownMenuItem
              onClick={handleFetchRecs}
              disabled={isLoadingRecs}
              className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
            >
              {isLoadingRecs ? (
                <Loader2 className='w-3.5 h-3.5 mr-2 animate-spin' />
              ) : (
                <Sparkles className='w-3.5 h-3.5 mr-2 text-white/70' />
              )}
              Get similar songs
            </DropdownMenuItem>
            <DropdownMenuSeparator className='bg-white/10 my-1' />
            {song?.album_id && (
              <DropdownMenuItem
                onClick={handleGoToAlbum}
                className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
              >
                <Disc3 className='w-3.5 h-3.5 mr-2 text-white/70' />
                Go to Album
              </DropdownMenuItem>
            )}
            {song?.artist_map?.primary_artists?.[0] && (
              <DropdownMenuItem
                onClick={handleGoToArtist}
                className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
              >
                <User className='w-3.5 h-3.5 mr-2 text-white/70' />
                Go to Artist
              </DropdownMenuItem>
            )}
            {!isCurrentSong && (
              <>
                <DropdownMenuSeparator className='bg-white/10 my-1' />
                <DropdownMenuItem
                  onClick={handleRemove}
                  className='cursor-pointer text-sm text-red-400 hover:text-red-300 focus:bg-red-500/15 focus:text-red-300 rounded-lg transition-colors'
                >
                  <X className='w-3.5 h-3.5 mr-2' />
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
    onFetchRecommendations,
    isLoadingRecs,
    variant,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: song.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition || 'transform 150ms ease',
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
const QueueTab = memo(({ variant, showHeader = false } = {}) => {
  const playlist = usePlayerStore((s) => s.playlist);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const currentSongId = currentSong?.id;
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSong = usePlayerStore((s) => s.playSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const replaceQueue = usePlayerStore((s) => s.replaceQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const setAutoFetchRecommendations = usePlayerStore((s) => s.setAutoFetchRecommendations);

  const [activeId, setActiveId] = useState(null);
  const [fetchingRecs, setFetchingRecs] = useState(false);
  const [loadingSongId, setLoadingSongId] = useState(null);

  const { refetch: fetchRecommendations } = useSongRecommendationsQuery(currentSongId, {
    enabled: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handlePlay = useCallback(
    (song, isCurrentSong) => {
      if (isCurrentSong) {
        handlePlayPause();
      } else {
        playSong(song);
      }
    },
    [handlePlayPause, playSong]
  );

  const handleRemove = useCallback(
    (songId, name, isCurrentSong) => {
      if (isCurrentSong) {
        toast.error('Cannot remove currently playing song');
        return;
      }
      setPlaylist(playlist.filter((item) => item.id !== songId));
      toast.success(`Removed "${name}"`);
    },
    [setPlaylist, playlist]
  );

  const handleClearQueue = useCallback(() => {
    clearQueue();
    toast.success('Queue cleared');
  }, [clearQueue]);

  const handleFetchAndReplace = useCallback(async () => {
    if (!currentSongId) return;
    setFetchingRecs(true);
    try {
      const { data } = await fetchRecommendations();
      if (data?.length > 0) {
        replaceQueue(data, true);
        toast.success(`Added ${data.length} recommendations`);
      } else {
        toast.info('No recommendations found');
      }
    } catch {
      toast.error('Failed to fetch recommendations');
    }
    setFetchingRecs(false);
  }, [currentSongId, fetchRecommendations, replaceQueue]);

  const handleFetchAndAdd = useCallback(async () => {
    if (!currentSongId) return;
    setFetchingRecs(true);
    try {
      const { data } = await fetchRecommendations();
      if (data?.length > 0) {
        const addToQueue = usePlayerStore.getState().addToQueue;
        addToQueue(data);
        toast.success(`Added ${data.length} songs to queue`);
      } else {
        toast.info('No recommendations found');
      }
    } catch {
      toast.error('Failed to fetch recommendations');
    }
    setFetchingRecs(false);
  }, [currentSongId, fetchRecommendations]);

  const handleToggleAutoFetch = useCallback(() => {
    setAutoFetchRecommendations(!autoFetchRecommendations);
    toast.success(autoFetchRecommendations ? 'Auto-fetch disabled' : 'Auto-fetch enabled');
  }, [autoFetchRecommendations, setAutoFetchRecommendations]);

  const handleSongFetchRecs = useCallback(
    async (songId, songName) => {
      if (!songId || loadingSongId) return;
      setLoadingSongId(songId);
      try {
        const { fetchSongRecommendations } = await import('@/api/music/songs');
        const data = await fetchSongRecommendations(songId);
        if (data?.length > 0) {
          addToQueue(data);
          toast.success(`Added ${data.length} similar songs`);
        } else {
          toast.info('No similar songs found');
        }
      } catch {
        toast.error('Failed to fetch recommendations');
      }
      setLoadingSongId(null);
    },
    [loadingSongId, addToQueue]
  );

  const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);
      if (active.id !== over?.id) {
        const oldIndex = playlist.findIndex((s) => s.id === active.id);
        const newIndex = playlist.findIndex((s) => s.id === over?.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          setPlaylist(arrayMove(playlist, oldIndex, newIndex));
        }
      }
    },
    [playlist, setPlaylist]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const activeSong = useMemo(
    () => (activeId ? playlist.find((s) => s.id === activeId) : null),
    [activeId, playlist]
  );

  const playlistIds = useMemo(() => playlist.map((s) => s.id), [playlist]);

  if (!playlist?.length) {
    return (
      <div className='flex flex-col justify-center items-center h-[70vh] gap-3'>
        <ListMusic className='w-10 h-10 text-white/20' />
        <p className='text-sm text-white/45 font-medium'>Queue is empty</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className='h-full'>
        {showHeader && (
          <div className='flex items-center justify-between mb-3 px-2 pt-1'>
            <p className='text-xs text-white/50 font-medium'>
              {playlist.length} song{playlist.length !== 1 ? 's' : ''}
            </p>
            <div className='flex items-center gap-1'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div variants={buttonVariants} whileHover='hover' whileTap='tap'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer'
                      onClick={handleClearQueue}
                      disabled={playlist.length <= 1}
                      aria-label='Clear queue'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side='bottom' className='text-xs'>
                  Clear queue
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer'
                        disabled={fetchingRecs}
                        aria-label='Recommendations'
                      >
                        {fetchingRecs ? (
                          <Loader2 className='h-3.5 w-3.5 animate-spin text-white/70' />
                        ) : (
                          <Sparkles className='h-3.5 w-3.5' />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side='bottom' className='text-xs'>
                    Recommendations
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align='end'
                  className='w-52 bg-[#161822]/95 backdrop-blur-xl border-white/10 text-white shadow-2xl rounded-xl p-1.5'
                >
                  <DropdownMenuItem
                    onClick={handleFetchAndAdd}
                    className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                  >
                    <RefreshCw className='w-3.5 h-3.5 mr-2 text-white/70' />
                    Add to queue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleFetchAndReplace}
                    className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                  >
                    <Sparkles className='w-3.5 h-3.5 mr-2 text-white/70' />
                    Replace queue
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className='bg-white/10 my-1' />
                  <DropdownMenuItem
                    onClick={handleToggleAutoFetch}
                    className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                  >
                    {autoFetchRecommendations ? (
                      <ToggleRight className='w-3.5 h-3.5 mr-2 text-white' />
                    ) : (
                      <ToggleLeft className='w-3.5 h-3.5 mr-2 text-white/50' />
                    )}
                    Auto-fetch: {autoFetchRecommendations ? 'On' : 'Off'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={playlistIds} strategy={verticalListSortingStrategy}>
            <div className='space-y-0.5'>
              {playlist.map((song) => (
                <SortableSongItem
                  key={song.id}
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

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeSong && (
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
