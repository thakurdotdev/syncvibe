import { memo, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, Music, Play, Search } from 'lucide-react';

// Memoized Search Result Item
const SearchResultItem = memo(({ song, onSelect }) => {
  const handleClick = useCallback(() => onSelect(song), [song, onSelect]);

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
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-xl cursor-pointer',
        'hover:bg-accent/50 transition-colors duration-150',
        'active:scale-[0.98]'
      )}
    >
      {/* Album Art */}
      <div className='relative h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0'>
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
          <Play className='h-5 w-5 sm:h-6 sm:w-6 text-white' />
        </div>
      </div>

      {/* Song Info */}
      <div className='flex-1 min-w-0'>
        <p className='font-medium truncate text-sm sm:text-base group-hover:text-primary transition-colors'>
          {song.name}
        </p>
        <p className='text-xs sm:text-sm text-muted-foreground truncate'>{artistName}</p>
      </div>

      {/* Duration */}
      {duration && (
        <span className='text-xs sm:text-sm text-muted-foreground tabular-nums shrink-0'>
          {duration}
        </span>
      )}
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
const ResultsList = memo(({ results, onSelectSong }) => (
  <div className='space-y-1'>
    {results.map((song) => (
      <SearchResultItem key={song.id} song={song} onSelect={onSelectSong} />
    ))}
  </div>
));

// Main SearchDialog Component
const SearchDialog = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchResults,
  isSearchLoading,
  onSelectSong,
}) => {
  const handleInputChange = useCallback((e) => onSearchChange(e.target.value), [onSearchChange]);

  const hasResults = useMemo(() => searchResults?.length > 0, [searchResults?.length]);
  const hasQuery = useMemo(() => Boolean(searchQuery), [searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col p-4 sm:p-6 gap-0 rounded-none sm:rounded-lg'>
        <DialogHeader className='pb-3'>
          <DialogTitle className='flex items-center gap-2 text-lg sm:text-xl'>
            <Music className='h-4 w-4 sm:h-5 sm:w-5 text-primary' />
            Search Songs
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-3 sm:space-y-4 flex-1 min-h-0 flex flex-col'>
          {/* Search Input */}
          <div className='relative'>
            <Search className='absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search songs, artists...'
              value={searchQuery}
              onChange={handleInputChange}
              className='pl-9 sm:pl-10 h-10 sm:h-12 rounded-full bg-accent/30 border-border/50 text-sm'
              autoFocus
            />
          </div>

          {/* Results */}
          <ScrollArea className='flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6'>
            {isSearchLoading ? (
              <LoadingState />
            ) : !hasQuery ? (
              <EmptyState />
            ) : !hasResults ? (
              <NoResultsState />
            ) : (
              <ResultsList results={searchResults} onSelectSong={onSelectSong} />
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(SearchDialog);
