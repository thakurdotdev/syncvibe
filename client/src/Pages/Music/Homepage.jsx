import { ArrowRight, ChevronRight, Music2, RotateCcw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/Context/Context';
import { paths } from '@/lib/paths';
import { getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useHomepageModulesQuery,
  useRecommendationsQuery,
} from '@/hooks/queries/useHomepageQueries';
import { cn } from '@/lib/utils';
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from '@/Pages/Music/Cards';
import { QuickPicks, QuickPicksSkeleton, TrendingChart } from './HomeSections';

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

/**
 * Opening of the home screen: one line of greeting and one slim way into a room, so the music
 * starts on the first screen. Side by side on desktop, stacked on phones.
 */
const Hero = () => {
  const { user } = useProfile();
  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const memberCount = useGroupSessionStore((s) => s.groupMembers?.length ?? 0);
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const firstName = user?.name?.split(' ')[0];
  const roomArt = currentGroup ? getSongImage(currentSong, 'medium') : '';

  return (
    <header className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8'>
      <h1 className='min-w-0 truncate text-2xl font-bold md:text-3xl'>
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h1>

      <Link
        to={paths.rooms}
        className='press group flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-card p-2 pr-3 hover:bg-accent md:w-[340px]'
      >
        <span className='grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-raised'>
          {roomArt ? (
            <img src={roomArt} alt='' className='h-full w-full object-cover' />
          ) : (
            <Users className='h-[18px] w-[18px]' />
          )}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-semibold'>
            {currentGroup ? `Back to ${currentGroup.name}` : 'Listen together'}
          </span>
          <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            {currentGroup && (
              <span className='live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-live' />
            )}
            <span className='truncate'>
              {currentGroup
                ? `${memberCount} listening now`
                : 'Start a room and play in sync with friends'}
            </span>
          </span>
        </span>
        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground'>
          <ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
        </span>
      </Link>
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
  <div className='mx-auto max-w-[1400px] space-y-8 px-4 py-5 md:space-y-10 md:px-8 md:py-8'>
    <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8'>
      <Skeleton className='h-8 w-64 rounded-lg md:h-9' />
      <Skeleton className='h-[58px] rounded-2xl md:w-[340px]' />
    </div>
    <QuickPicksSkeleton />
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
      <div className='mx-auto max-w-[1400px] space-y-8 px-4 py-5 md:space-y-10 md:px-8 md:py-8'>
        <Hero />
        {reccLoading ? (
          <QuickPicksSkeleton />
        ) : (
          recommendations?.recentlyPlayed?.length > 0 && (
            <Section title='Jump back in' link='/library/history' linkText='History'>
              <QuickPicks songs={recommendations.recentlyPlayed} />
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
            <TrendingChart songs={homePageData.trending} />
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
