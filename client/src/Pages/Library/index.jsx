import { MotionConfig, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useUserPlaylistsQuery } from '@/hooks/queries/usePlaylistQueries';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import HistoryPage from '@/Pages/Music/History';
import UserPlaylist from '@/Pages/Music/UserPlaylist';
import { SPRING } from '@/lib/motion';

/** Everything you've saved or played: playlists and listening history under one roof. */
const LibraryPage = ({ tab = 'playlists' }) => {
  const { data: playlists } = useUserPlaylistsQuery();
  const tabs = [
    { key: 'playlists', label: 'Playlists', to: paths.library, count: playlists?.length },
    { key: 'history', label: 'History', to: paths.history },
  ];

  return (
    <MotionConfig reducedMotion='user'>
      <div className='mx-auto w-full max-w-[1400px]'>
        <header className='flex flex-wrap items-end justify-between gap-4 px-4 pt-6 md:px-6 md:pt-10'>
          <h1 className='text-4xl font-bold md:text-5xl'>Library</h1>
          <nav aria-label='Library sections' className='flex rounded-full bg-muted p-1'>
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  to={t.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-8 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-150',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId='library-tab'
                      transition={SPRING}
                      className='absolute inset-0 rounded-full bg-background shadow-sm'
                    />
                  )}
                  <span className='relative'>{t.label}</span>
                  {t.count > 0 && (
                    <span className='relative text-xs tabular-nums text-muted-foreground'>
                      {t.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </header>

        {tab === 'history' ? (
          <HistoryPage embedded />
        ) : (
          <div className='px-4 pb-32 pt-8 md:px-6'>
            <UserPlaylist embedded />
          </div>
        )}
      </div>
    </MotionConfig>
  );
};

export default LibraryPage;
