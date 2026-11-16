import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import he from 'he';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { homepageKeys } from '@/api/music/homepage';
import { fetchTaste, personalKeys, saveTaste, searchArtists } from '@/api/music/personal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MAX_ARTISTS = 20;

const artistImage = (artist) =>
  Array.isArray(artist.image)
    ? artist.image[1]?.link || artist.image[0]?.link || null
    : artist.image || null;

const Card = ({ title, description, children }) => (
  <section className='bezel'>
    <div className='bezel-inner space-y-4 p-5 sm:p-6'>
      <div className='space-y-1'>
        <h2 className='text-lg font-semibold'>{title}</h2>
        {description && <p className='text-sm text-muted-foreground'>{description}</p>}
      </div>
      {children}
    </div>
  </section>
);

/** Searches the catalog's artists as you type, a moment after you stop. */
const useArtistSearch = (query) => {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  return useQuery({
    queryKey: ['artistSearch', debounced.trim().toLowerCase()],
    queryFn: () => searchArtists(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });
};

/**
 * Your music taste: the languages to recommend in, artists you love (they shape recommendations
 * before you've played much) and whether friends see what you're playing. Saved to your account,
 * so the app and the web use the same.
 */
const MusicTaste = () => {
  const { data: saved, isLoading } = useQuery({
    queryKey: personalKeys.taste(),
    queryFn: fetchTaste,
  });

  if (isLoading || !saved) {
    return (
      <div className='mx-auto w-full max-w-2xl space-y-6 px-4 py-8 md:py-12'>
        <Skeleton className='h-10 w-56' />
        <Skeleton className='h-48 rounded-[1.75rem]' />
        <Skeleton className='h-64 rounded-[1.75rem]' />
      </div>
    );
  }
  return <TasteForm saved={saved} />;
};

/** The form, started from what's saved. */
const TasteForm = ({ saved }) => {
  const queryClient = useQueryClient();
  const [languages, setLanguages] = useState(saved.languages ?? []);
  const [artists, setArtists] = useState(saved.artists ?? []);
  const [shareListening, setShareListening] = useState(saved.shareListening ?? true);
  const [query, setQuery] = useState('');
  const { data: results = [], isFetching: searching } = useArtistSearch(query);

  const dirty = useMemo(
    () =>
      !!saved &&
      (JSON.stringify(languages) !== JSON.stringify(saved.languages ?? []) ||
        JSON.stringify(artists.map((a) => a.id)) !==
          JSON.stringify((saved.artists ?? []).map((a) => a.id)) ||
        shareListening !== (saved.shareListening ?? true)),
    [saved, languages, artists, shareListening]
  );

  const save = useMutation({
    mutationFn: () => saveTaste({ languages, artists, shareListening }),
    onSuccess: (taste) => {
      queryClient.setQueryData(personalKeys.taste(), (old) => ({ ...old, ...taste }));
      queryClient.invalidateQueries({ queryKey: personalKeys.shelves() });
      queryClient.invalidateQueries({ queryKey: homepageKeys.recommendations() });
      toast.success('Saved. Your recommendations will follow it.');
    },
    onError: () => toast.error("Couldn't save. Try again."),
  });

  const toggleLanguage = (language) =>
    setLanguages((current) =>
      current.includes(language) ? current.filter((l) => l !== language) : [...current, language]
    );

  const addArtist = (artist) => {
    if (artists.some((a) => a.id === artist.id)) return;
    if (artists.length >= MAX_ARTISTS) {
      toast.info(`Up to ${MAX_ARTISTS} artists`);
      return;
    }
    setArtists((current) => [
      ...current,
      { id: artist.id, name: he.decode(artist.name), image: artistImage(artist) },
    ]);
    setQuery('');
  };

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6 px-4 pb-32 pt-8 md:pt-12'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-bold md:text-4xl'>Your music taste</h1>
        <p className='text-muted-foreground'>
          Shapes Made for you, your mixes and moods, on the web and in the app.
        </p>
      </header>

      <Card
        title='Languages'
        description='Songs in these languages come first. With none chosen, we go by what you play.'
      >
        <div className='flex flex-wrap gap-2'>
          {(saved?.availableLanguages ?? []).map((language) => {
            const selected = languages.includes(language);
            return (
              <button
                key={language}
                type='button'
                aria-pressed={selected}
                onClick={() => toggleLanguage(language)}
                className={cn(
                  'press flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium capitalize transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                {selected && <Check className='h-3.5 w-3.5' />}
                {language}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title='Artists you love'
        description='New here? These start your recommendations until you have played a few songs.'
      >
        {artists.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {artists.map((artist) => (
              <span
                key={artist.id}
                className='flex h-9 items-center gap-2 rounded-full border border-border bg-card pl-1 pr-1.5 text-sm'
              >
                <Avatar className='h-7 w-7'>
                  <AvatarImage src={artist.image} alt='' />
                  <AvatarFallback className='text-[10px]'>{artist.name[0]}</AvatarFallback>
                </Avatar>
                <span className='max-w-[10rem] truncate font-medium'>{artist.name}</span>
                <button
                  type='button'
                  onClick={() => setArtists((current) => current.filter((a) => a.id !== artist.id))}
                  aria-label={`Remove ${artist.name}`}
                  className='grid h-6 w-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground'
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search artists'
            aria-label='Search artists'
            className='pl-9'
          />
          {searching && (
            <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground' />
          )}
        </div>

        {query.trim().length >= 2 && results.length > 0 && (
          <ul className='divide-y divide-border overflow-hidden rounded-xl border border-border'>
            {results.map((artist) => {
              const added = artists.some((a) => a.id === artist.id);
              return (
                <li key={artist.id}>
                  <button
                    type='button'
                    disabled={added}
                    onClick={() => addArtist(artist)}
                    className='flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-accent disabled:cursor-default disabled:opacity-60'
                  >
                    <Avatar className='h-9 w-9'>
                      <AvatarImage src={artistImage(artist)} alt='' />
                      <AvatarFallback>{artist.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                      {he.decode(artist.name)}
                    </span>
                    {added ? (
                      <Check className='h-4 w-4 text-muted-foreground' />
                    ) : (
                      <Plus className='h-4 w-4 text-muted-foreground' />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title='Friends'>
        <div className='flex items-start justify-between gap-4'>
          <span className='space-y-1'>
            <span id='share-listening' className='block text-sm font-medium'>
              Share what I&apos;m playing
            </span>
            <span id='share-listening-help' className='block text-sm text-muted-foreground'>
              People you follow who follow you back see your song or room, and can make a Blend with
              you.
            </span>
          </span>
          <button
            type='button'
            role='switch'
            aria-checked={shareListening}
            aria-labelledby='share-listening'
            aria-describedby='share-listening-help'
            onClick={() => setShareListening((value) => !value)}
            className={cn(
              'relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
              shareListening ? 'bg-primary' : 'bg-foreground/20'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                shareListening ? 'translate-x-[22px]' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </Card>

      <div className='flex justify-end'>
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className='min-w-28 gap-2 rounded-full'
        >
          {save.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
          Save
        </Button>
      </div>
    </div>
  );
};

export default MusicTaste;
