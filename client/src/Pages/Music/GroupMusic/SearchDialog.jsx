import { memo, useCallback, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Loader2, Music, Play, Search, ListPlus, MoreVertical, X } from 'lucide-react';

const SearchResultItem = memo(({ song, onPlayNow, onAddToQueue }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handlePlayNow = useCallback(() => {
    onPlayNow(song);
    setIsMenuOpen(false);
  }, [song, onPlayNow]);

  const handleAddToQueue = useCallback(() => {
    onAddToQueue(song);
    setIsMenuOpen(false);
  }, [song, onAddToQueue]);

  const duration = useMemo(() => {
    if (!song.duration) return null;
    const mins = Math.floor(song.duration / 60);
    const secs = String(song.duration % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }, [song.duration]);

  const artistName = useMemo(
    () => song.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
    [song.artist_map?.primary_artists]
  );

  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 rounded-xl w-full',
        'hover:bg-accent/50 transition-colors duration-150'
      )}
    >
      {/* Album Art - Click to play */}
      <div
        onClick={handlePlayNow}
        className='relative h-10 w-10 rounded-lg overflow-hidden shrink-0 cursor-pointer'
      >
        <img
          src={song.image?.[1]?.link}
          alt={song.name}
          className='h-full w-full object-cover'
          loading='lazy'
        />
        <div
          className={cn(
            'absolute inset-0 bg-black/60 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        >
          <Play className='h-4 w-4 text-white' />
        </div>
      </div>

      {/* Song Info - Click to play */}
      <div className='flex-1 min-w-0 max-w-[280px] cursor-pointer' onClick={handlePlayNow}>
        <p className='font-medium truncate text-sm group-hover:text-primary transition-colors'>
          {song.name}
        </p>
        <p className='text-xs text-muted-foreground truncate'>{artistName}</p>
      </div>

      {/* Duration */}
      {duration && (
        <span className='text-xs text-muted-foreground tabular-nums shrink-0'>{duration}</span>
      )}

      {/* Action Buttons */}
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='h-7 w-7 shrink-0 text-muted-foreground'>
            <MoreVertical className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuItem onClick={handlePlayNow} className='gap-2'>
            <Play className='h-4 w-4' />
            Play Now
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAddToQueue} className='gap-2'>
            <ListPlus className='h-4 w-4' />
            Add to Queue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

// Memoized Empty/Loading States
const LoadingState = memo(() => (
  <div className='flex flex-col items-center justify-center h-64 gap-3'>
    <Loader2 className='h-8 w-8 animate-spin text-primary' />
    <p className='text-muted-foreground text-sm'>Searching...</p>
  </div>
));

const EmptyState = memo(() => (
  <div className='flex flex-col items-center justify-center h-64 gap-3'>
    <Search className='h-12 w-12 text-muted-foreground/30' />
    <p className='text-muted-foreground'>Start typing to search</p>
  </div>
));

const NoResultsState = memo(() => (
  <div className='flex flex-col items-center justify-center h-64 gap-3'>
    <Music className='h-12 w-12 text-muted-foreground/30' />
    <p className='text-muted-foreground'>No songs found</p>
    <p className='text-muted-foreground/70 text-sm'>Try a different search term</p>
  </div>
));

// Memoized Results List
const ResultsList = memo(({ results, onPlayNow, onAddToQueue }) => (
  <div className='space-y-0.5 w-full overflow-hidden'>
    {results.map((song) => (
      <SearchResultItem
        key={song.id}
        song={song}
        onPlayNow={onPlayNow}
        onAddToQueue={onAddToQueue}
      />
    ))}
  </div>
));

// Main SearchSheet Component (converted from Dialog)
const SearchSheet = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchResults,
  isSearchLoading,
  onPlayNow,
  onAddToQueue,
}) => {
  const handleInputChange = useCallback((e) => onSearchChange(e.target.value), [onSearchChange]);

  const hasResults = useMemo(() => searchResults?.length > 0, [searchResults?.length]);
  const hasQuery = useMemo(() => Boolean(searchQuery), [searchQuery]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className='w-full sm:max-w-md p-0 flex flex-col'>
        <SheetHeader className='px-4 pt-4 pb-3 border-b space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded-lg bg-primary/10'>
                <Search className='h-4 w-4 text-primary' />
              </div>
              <SheetTitle className='text-lg'>Search Songs</SheetTitle>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => onClose(false)}
              className='h-8 w-8 rounded-full'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
          <SheetDescription className='sr-only'>
            Search for songs to add to the queue
          </SheetDescription>

          {/* Search Input */}
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search songs, artists...'
              value={searchQuery}
              onChange={handleInputChange}
              className='pl-9 h-10 rounded-full bg-accent/30 border-border/50 text-sm'
              autoFocus
            />
          </div>

          {/* Tip */}
          <p className='text-xs text-muted-foreground text-center'>
            Tap to play now • <ListPlus className='h-3 w-3 inline' /> to add to queue
          </p>
        </SheetHeader>

        <ScrollArea className='flex-1 overflow-hidden'>
          <div className='p-3 overflow-hidden'>
            {isSearchLoading ? (
              <LoadingState />
            ) : !hasQuery ? (
              <EmptyState />
            ) : !hasResults ? (
              <NoResultsState />
            ) : (
              <ResultsList
                results={searchResults}
                onPlayNow={onPlayNow}
                onAddToQueue={onAddToQueue}
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default memo(SearchSheet);
