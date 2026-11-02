import { Link } from 'react-router-dom';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import HistoryPage from '@/Pages/Music/History';
import UserPlaylist from '@/Pages/Music/UserPlaylist';

const TABS = [
  { key: 'playlists', label: 'Playlists', to: paths.library },
  { key: 'history', label: 'History', to: paths.history },
];

/** Everything you've saved or played: playlists and listening history under one roof. */
const LibraryPage = ({ tab = 'playlists' }) => (
  <div className='mx-auto w-full max-w-[1400px]'>
    <header className='px-4 pt-6 md:px-6 md:pt-8'>
      <h1 className='text-3xl font-bold md:text-4xl'>Library</h1>
      <div role='tablist' aria-label='Library sections' className='mt-5 flex gap-1.5'>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              to={t.to}
              role='tab'
              aria-selected={active}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-medium leading-9 transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </header>

    {tab === 'history' ? (
      <HistoryPage embedded />
    ) : (
      <div className='px-4 py-6 pb-32 md:px-6'>
        <UserPlaylist embedded />
      </div>
    )}
  </div>
);

export default LibraryPage;
