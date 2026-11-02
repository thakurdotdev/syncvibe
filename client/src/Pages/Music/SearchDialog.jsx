import { createPortal } from 'react-dom';
import { History, ListMusic, Loader2, Music2, Search, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHistoryQuery } from '@/hooks/queries/useHistoryQuery';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import { useBackendSearchQuery } from '@/hooks/queries/useSongQueries';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { getPlaylistImageUrl, SongCard } from './Cards';
import './music.css';
import { FADE, POP, SPRING } from '@/lib/motion';

const SCOPES = [
  { key: 'songs', label: 'Songs', icon: Music2, placeholder: 'Search songs, artists, albums' },
  { key: 'history', label: 'History', icon: History, placeholder: 'Search what you’ve played' },
  { key: 'playlists', label: 'Playlists', icon: ListMusic, placeholder: 'Search your playlists' },
];

const SongGrid = ({ songs }) => (
  <div className='grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3'>
    {songs.map((song, index) => (
      <div key={song?.id || index}>
        <SongCard song={song} />
      </div>
    ))}
  </div>
);

const ResultHeading = ({ title, count }) => (
  <div className='mb-3 flex items-center justify-between'>
    <h2 className='text-base font-semibold'>{title}</h2>
    {count != null && (
      <span className='rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground'>
        {count}
      </span>
    )}
  </div>
);

const Loading = () => (
  <div className='grid h-40 place-items-center'>
    <Loader2 className='h-6 w-6 animate-spin text-primary' />
  </div>
);

const Empty = ({ title, hint }) => (
  <div className='search-dialog-empty'>
    <div className='search-dialog-empty-icon'>
      <Search className='h-8 w-8' />
    </div>
    <p className='mb-1 text-base font-medium'>{title}</p>
    {hint && <p className='text-sm text-muted-foreground'>{hint}</p>}
  </div>
);

const SongsResults = ({ query }) => {
  const { data, isLoading } = useBackendSearchQuery(query);
  if (!query) return <Empty title='Find any song' hint='Search by title, artist or album.' />;
  if (isLoading) return <Loading />;
  if (!data?.songs?.length)
    return (
      <Empty
        title={`No songs match “${query}”`}
        hint='Check the spelling or try the artist’s name.'
      />
    );
  return (
    <section>
      <ResultHeading title='Songs' count={data.count} />
      <SongGrid songs={data.songs} />
    </section>
  );
};

const HistoryResults = ({ query }) => {
  const { data, isLoading } = useHistoryQuery({
    page: 1,
    limit: 24,
    sortBy: 'lastPlayedAt',
    sortOrder: 'DESC',
    searchQuery: query,
  });
  if (isLoading) return <Loading />;
  const songs = data?.songs ?? [];
  if (!songs.length) {
    return query ? (
      <Empty
        title={`Nothing in your history matches “${query}”`}
        hint='Try the Songs tab to search everything.'
      />
    ) : (
      <Empty title='No listening history yet' hint='Songs you play show up here.' />
    );
  }
  return (
    <section>
      <ResultHeading title={query ? 'From your history' : 'Recently played'} count={data?.count} />
      <SongGrid songs={songs} />
    </section>
  );
};

const PlaylistResults = ({ query, onPick }) => {
  const { data: playlists = [], isLoading } = useUserPlaylistsQuery();
  const matches = useMemo(() => {
    const q = query.toLowerCase();
    return q ? playlists.filter((p) => p.name?.toLowerCase().includes(q)) : playlists;
  }, [playlists, query]);

  if (isLoading) return <Loading />;
  if (!matches.length) {
    return query ? (
      <Empty title={`No playlist called “${query}”`} />
    ) : (
      <Empty title='You haven’t made a playlist yet' hint='Create one from your Library.' />
    );
  }
  return (
    <section>
      <ResultHeading title='Your playlists' count={matches.length} />
      <ul className='grid grid-cols-1 gap-1 sm:grid-cols-2'>
        {matches.map((pl) => {
          const img =
            getPlaylistImageUrl(pl.previewSongs?.[0]?.image) || getPlaylistImageUrl(pl.image);
          const count = Number(pl.songCount) || 0;
          return (
            <li key={pl.id}>
              <button
                type='button'
                onClick={() => onPick(paths.myPlaylist(pl.id))}
                className='flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-secondary'
              >
                {img ? (
                  <img src={img} alt='' className='h-12 w-12 shrink-0 rounded-lg object-cover' />
                ) : (
                  <span className='grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-lg font-bold text-primary'>
                    {pl.name?.[0]?.toUpperCase()}
                  </span>
                )}
                <span className='min-w-0'>
                  <span className='block truncate text-sm font-semibold'>{pl.name}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {count} {count === 1 ? 'song' : 'songs'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const SearchDialog = ({ open, setOpen }) => {
  const navigate = useNavigate();
  const scope = useUiStore((s) => s.searchScope);
  const setScope = useUiStore((s) => s.setSearchScope);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
    setDebouncedQuery('');
  }, [setOpen]);

  const pick = useCallback(
    (to) => {
      handleClose();
      navigate(to);
    },
    [handleClose, navigate]
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Tab / Shift+Tab in the field cycles the search scope.
  const handleInputKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const i = SCOPES.findIndex((s) => s.key === scope);
    const next = (i + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length;
    setScope(SCOPES[next].key);
  };

  const active = SCOPES.find((s) => s.key === scope) ?? SCOPES[0];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className='search-dialog-overlay'
          {...FADE}
          onClick={(e) => e.target === overlayRef.current && handleClose()}
        >
          <motion.div
            role='dialog'
            aria-modal='true'
            aria-label='Search'
            className='search-dialog-container'
            {...POP}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='search-dialog-header'>
              <div className='search-dialog-input-wrap'>
                <Search className='search-dialog-input-icon' />
                <input
                  ref={inputRef}
                  type='text'
                  placeholder={active.placeholder}
                  className='search-dialog-input'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  aria-describedby='search-scope-hint'
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      inputRef.current?.focus();
                    }}
                    className='search-dialog-clear'
                    type='button'
                    aria-label='Clear search'
                  >
                    <XCircle className='h-4 w-4' />
                  </button>
                )}
              </div>
              <Button
                size='icon'
                variant='ghost'
                className='search-dialog-close'
                onClick={handleClose}
                aria-label='Close search'
              >
                <X className='h-5 w-5' />
              </Button>
            </div>

            <div className='flex items-center gap-1.5 border-b border-border/40 px-3 py-2 sm:px-4'>
              <div role='tablist' aria-label='Search in' className='flex gap-1.5'>
                {SCOPES.map(({ key, label, icon: Icon }) => {
                  const selected = key === scope;
                  return (
                    <button
                      key={key}
                      type='button'
                      role='tab'
                      aria-selected={selected}
                      onClick={() => {
                        setScope(key);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
                        selected ? 'text-background' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId='search-scope'
                          className='absolute inset-0 rounded-full bg-foreground'
                          transition={SPRING}
                        />
                      )}
                      <Icon className='relative h-3.5 w-3.5' />
                      <span className='relative'>{label}</span>
                    </button>
                  );
                })}
              </div>
              <span
                id='search-scope-hint'
                className='ml-auto hidden text-[11px] text-muted-foreground sm:block'
              >
                <kbd className='rounded border border-border px-1 py-px font-sans'>Tab</kbd> to
                switch
              </span>
            </div>

            <ScrollArea className='search-dialog-body'>
              <div className='p-4 sm:p-5'>
                {scope === 'history' ? (
                  <HistoryResults query={debouncedQuery} />
                ) : scope === 'playlists' ? (
                  <PlaylistResults query={searchQuery.trim()} onPick={pick} />
                ) : (
                  <SongsResults query={debouncedQuery} />
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SearchDialog;
