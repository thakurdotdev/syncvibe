import { Loader2, Search, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { songArtists, songCoverOf, songName } from '@/lib/chatSongs';
import { usePlayerStore } from '@/stores/playerStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

const SONG_URL = import.meta.env.VITE_SONG_URL;
const SEARCH_DELAY_MS = 350;

const SongRow = ({ song, label, onPick }) => (
  <button
    type='button'
    onClick={() => onPick(song)}
    className='group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring'
  >
    <span className='h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted'>
      {songCoverOf(song) && (
        <img src={songCoverOf(song)} alt='' loading='lazy' className='h-full w-full object-cover' />
      )}
    </span>
    <span className='min-w-0 flex-1'>
      {label && (
        <span className='block text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
          {label}
        </span>
      )}
      <span className='block truncate text-sm font-medium'>{songName(song)}</span>
      <span className='block truncate text-xs text-muted-foreground'>{songArtists(song)}</span>
    </span>
    <Send className='h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100' />
  </button>
);

/** Finds a song to share in the conversation; the one playing is offered first. */
const SongPickerDialog = ({ open, onOpenChange, onPick }) => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const searching = query.trim().length > 0;

  const changeQuery = (text) => {
    setQuery(text);
    setLoading(text.trim().length > 0);
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      axios
        .get(`${SONG_URL}/search/songs`, { params: { q }, signal: controller.signal })
        .then(({ data }) => setResults((data?.data?.results ?? []).filter((song) => song?.id)))
        .catch(() => !controller.signal.aborted && setResults([]))
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const changeOpen = (next) => {
    if (!next) changeQuery('');
    onOpenChange(next);
  };
  const pick = (song) => {
    changeQuery('');
    onPick(song);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className='gap-3 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Share a song</DialogTitle>
          <DialogDescription className='sr-only'>Search for a song to send</DialogDescription>
        </DialogHeader>

        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder='Search songs'
            aria-label='Search songs'
            className='pl-9 pr-9'
          />
          {loading && (
            <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground' />
          )}
        </div>

        <ScrollArea className='-mx-2 h-[min(420px,55vh)]'>
          <div className='space-y-0.5 px-2'>
            {!searching && currentSong?.id && (
              <SongRow song={currentSong} label='Playing now' onPick={pick} />
            )}
            {searching &&
              results.map((song) => <SongRow key={song.id} song={song} onPick={pick} />)}
            {searching && !loading && results.length === 0 && (
              <p className='px-2 py-10 text-center text-sm text-muted-foreground'>
                No songs found for &quot;{query.trim()}&quot;
              </p>
            )}
            {!searching && !currentSong?.id && (
              <p className='px-2 py-10 text-center text-sm text-muted-foreground'>
                Search for a song to send.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SongPickerDialog;
