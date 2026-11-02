import { ChevronRight, Music2, Plus, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/Context/Context';
import { paths } from '@/lib/paths';
import { getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useHomepageModulesQuery,
  useRecommendationsQuery,
} from '@/hooks/queries/useHomepageQueries';
import { cn } from '@/lib/utils';
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from '@/Pages/Music/Cards';
import { ResumeSession } from './History';

const Section = ({ title, children, className, link, linkText }) => (
  <section className={cn('space-y-3', className)}>
    <div className='flex items-end justify-between'>
      <h2 className='text-xl font-bold md:text-2xl'>{title}</h2>
      {link && (
        <Link
          to={link}
          className='inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground hover:text-foreground'
        >
          {linkText || 'See all'}
          <ChevronRight className='h-4 w-4' />
        </Link>
      )}
    </div>
    {children}
  </section>
);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Opening of the home screen: who you are, and the two things you can do right now. */
const Hero = () => {
  const { user } = useProfile();
  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const groupMembers = useGroupSessionStore((s) => s.groupMembers) ?? [];
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const firstName = user?.name?.split(' ')[0];
  const roomArt = currentGroup ? getSongImage(currentSong, 'large') : '';

  return (
    <header className='space-y-5'>
      <h1 className='text-4xl font-bold leading-[1.05] md:text-5xl'>
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h1>

      <div className='grid gap-3 sm:grid-cols-[1.4fr_1fr]'>
        <Link
          to={paths.rooms}
          className='group relative flex min-h-[132px] overflow-hidden rounded-3xl bg-foreground p-5 text-background transition-transform active:scale-[0.99]'
        >
          {roomArt && (
            <img
              src={roomArt}
              alt=''
              aria-hidden='true'
              className='absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl'
            />
          )}
          <div className='relative flex w-full items-end justify-between gap-4'>
            <div>
              {currentGroup ? (
                <>
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-xs font-semibold text-live-foreground'>
                    <span className='h-1.5 w-1.5 rounded-full bg-current' />
                    {groupMembers.length} listening now
                  </span>
                  <p className='mt-3 font-display text-2xl font-bold'>
                    Back to {currentGroup.name}
                  </p>
                </>
              ) : (
                <>
                  <p className='font-display text-2xl font-bold'>Start a room</p>
                  <p className='mt-1 max-w-xs text-sm opacity-70'>
                    Invite friends and play the same song, in sync, while you chat.
                  </p>
                </>
              )}
            </div>
            <span className='grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105'>
              {currentGroup ? <ChevronRight className='h-5 w-5' /> : <Plus className='h-5 w-5' />}
            </span>
          </div>
        </Link>

        <button
          type='button'
          onClick={() => setSearchOpen(true)}
          className='flex min-h-[132px] flex-col justify-between rounded-3xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/20'
        >
          <Search className='h-6 w-6 text-primary' />
          <span>
            <span className='block font-display text-2xl font-bold'>Find a song</span>
            <span className='mt-1 block text-sm text-muted-foreground'>
              Songs, albums and artists in every language you follow.
            </span>
          </span>
        </button>
      </div>
    </header>
  );
};

/** Native horizontal scroller: cheaper than a JS scroll area and snaps card-by-card. */
const ScrollableRow = ({ children }) => (
  <div className='row-scroll -mx-2 flex snap-x snap-mandatory scroll-px-2 gap-1 overflow-x-auto px-2 pb-3 [&>*]:snap-start'>
    {children}
  </div>
);

const CardSkeleton = ({ type = 'song' }) => {
  if (type === 'artist') {
    return (
      <div className='w-[150px] p-3 space-y-3'>
        <Skeleton className='w-full aspect-square rounded-full' />
        <div className='space-y-1.5 text-center'>
          <Skeleton className='h-4 w-4/5 mx-auto' />
          <Skeleton className='h-3 w-3/5 mx-auto' />
        </div>
      </div>
    );
  }

  return (
    <div className='w-[150px] p-2 space-y-2'>
      <Skeleton className='w-full aspect-square rounded-lg' />
      <div className='space-y-1.5'>
        <Skeleton className='h-4 w-4/5' />
        <Skeleton className='h-3 w-3/5' />
      </div>
    </div>
  );
};

const SectionSkeleton = ({ type = 'song', count = 12 }) => (
  <div className='space-y-3'>
    <div className='flex items-center gap-2'>
      <Skeleton className='h-5 w-32' />
    </div>
    <div className='flex gap-1 overflow-hidden pb-3'>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} type={type} />
      ))}
    </div>
  </div>
);

const HomepageSkeleton = () => (
  <div className='mx-auto max-w-[1400px] space-y-10 px-4 py-6 md:px-8 md:py-10'>
    <Skeleton className='h-12 w-72 rounded-xl' />
    <div className='grid gap-3 sm:grid-cols-[1.4fr_1fr]'>
      <Skeleton className='h-[132px] rounded-3xl' />
      <Skeleton className='h-[132px] rounded-3xl' />
    </div>
    <SectionSkeleton type='song' />
    <SectionSkeleton type='song' />
    <SectionSkeleton type='song' />
    <SectionSkeleton type='artist' />
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className='flex flex-col items-center justify-center min-h-[50vh] px-6'>
    <div className='p-6 rounded-2xl bg-destructive/10 border border-destructive/20 mb-6'>
      <Music2 className='w-12 h-12 text-destructive' />
    </div>
    <h3 className='text-lg font-semibold'>Something went wrong</h3>
    <p className='text-muted-foreground text-sm mt-1 mb-4'>{error}</p>
    <Button onClick={onRetry} variant='outline' size='sm' className='gap-2'>
      <RotateCcw className='w-4 h-4' />
      Try again
    </Button>
  </div>
);

const HomePage = () => {
  const { data: homePageData, isLoading, isError, error, refetch } = useHomepageModulesQuery();
  const { data: recommendations, isLoading: reccLoading } = useRecommendationsQuery();

  if (isLoading) return <HomepageSkeleton />;
  if (isError) return <ErrorState error={error?.message || 'Failed to load'} onRetry={refetch} />;
  if (!homePageData) return null;

  return (
    <div className='pb-32'>
      <div className='mx-auto max-w-[1400px] space-y-10 px-4 py-6 md:px-8 md:py-10'>
        <Hero />
        <ResumeSession />
        {reccLoading ? (
          <SectionSkeleton type='song' />
        ) : (
          recommendations?.recentlyPlayed?.length > 0 && (
            <Section title='Recently played' link='/library/history' linkText='History'>
              <ScrollableRow>
                {recommendations.recentlyPlayed.map((song) => (
                  <NewSongCard key={song.id} song={song} />
                ))}
              </ScrollableRow>
            </Section>
          )
        )}

        {reccLoading ? (
          <SectionSkeleton type='song' />
        ) : (
          recommendations?.songs?.length > 0 && (
            <Section title='Made for you'>
              <ScrollableRow>
                {recommendations.songs.map((song) => (
                  <NewSongCard key={song.id} song={song} />
                ))}
              </ScrollableRow>
            </Section>
          )
        )}

        {homePageData.trending?.length > 0 && (
          <Section title='Trending now'>
            <ScrollableRow>
              {homePageData.trending.map((song) => (
                <NewSongCard key={song.id} song={song} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.playlists?.length > 0 && (
          <Section title='Top playlists'>
            <ScrollableRow>
              {homePageData.playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.charts?.length > 0 && (
          <Section title='Charts'>
            <ScrollableRow>
              {homePageData.charts.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.artists?.length > 0 && (
          <Section title='Artists to know'>
            <ScrollableRow>
              {homePageData.artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.albums?.length > 0 && (
          <Section title='Albums'>
            <ScrollableRow>
              {homePageData.albums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.bhakti?.length > 0 && (
          <Section title='Discover'>
            <ScrollableRow>
              {homePageData.bhakti.map((song) => (
                <NewSongCard key={song.id} song={song} />
              ))}
            </ScrollableRow>
          </Section>
        )}
      </div>
    </div>
  );
};

export default HomePage;
