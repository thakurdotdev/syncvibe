import he from 'he';
import { Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { getArtistName, getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { FALLBACK_ART } from './nav';

/** Blurred artwork wash behind a card — the sidebar picks up the colour of what's playing. */
const ArtWash = ({ src }) =>
  src ? (
    <img
      src={src}
      alt=''
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-2xl saturate-150 dark:opacity-25'
    />
  ) : null;

/** Your active listening room, or an invitation to start one. */
export const LiveRoom = memo(({ collapsed }) => {
  const navigate = useNavigate();
  const { currentGroup, currentSong, isPlaying, groupMembers = [] } = useGroupMusic();
  const goToRooms = () => navigate(paths.rooms);

  if (!currentGroup) {
    if (collapsed) {
      return (
        <button
          type='button'
          onClick={goToRooms}
          title='Start a room'
          aria-label='Start a room'
          className='mx-auto grid h-11 w-11 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-live hover:text-live'
        >
          <Plus className='h-4 w-4' />
        </button>
      );
    }
    return (
      <div className='rounded-2xl border border-dashed border-border p-3.5'>
        <p className='font-display text-[15px] font-semibold leading-snug'>Listen together</p>
        <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
          Open a room and everyone hears the same song at the same second.
        </p>
        <button
          type='button'
          onClick={goToRooms}
          className='mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background transition-transform active:scale-95'
        >
          <Plus className='h-3.5 w-3.5' />
          Start a room
        </button>
      </div>
    );
  }

  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={goToRooms}
        title={`${currentGroup.name} — ${groupMembers.length} listening`}
        aria-label={`Open room ${currentGroup.name}`}
        className='relative mx-auto block h-11 w-11 rounded-full ring-2 ring-live ring-offset-2 ring-offset-sidebar'
      >
        <img src={art} alt='' className='h-full w-full rounded-full object-cover' />
        <span className='live-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-sidebar bg-live' />
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={goToRooms}
      className='group relative block w-full overflow-hidden rounded-2xl border border-live/30 bg-card text-left transition-colors hover:border-live/60'
    >
      <ArtWash src={art} />
      <div className='relative p-3'>
        <div className='flex items-center gap-2 text-[11px] font-semibold text-live'>
          <span className='live-dot h-2 w-2 rounded-full bg-live' />
          Live in your room
        </div>
        <div className='mt-2.5 flex items-center gap-3'>
          <div className='relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-lg'>
            <img src={art} alt='' className='h-full w-full object-cover' />
            {isPlaying && (
              <div className='absolute inset-0 grid place-items-center bg-black/35'>
                <Equalizer bars={3} className='h-3.5' barClassName='bg-white' />
              </div>
            )}
          </div>
          <div className='min-w-0'>
            <p className='truncate font-display text-[15px] font-semibold'>{currentGroup.name}</p>
            <p className='truncate text-xs text-muted-foreground'>
              {currentSong ? he.decode(currentSong.name || '') : 'Queue is empty'}
            </p>
          </div>
        </div>
        <div className='mt-3 flex items-center gap-2'>
          <div className='flex -space-x-1.5'>
            {groupMembers.slice(0, 4).map((m) => (
              <Avatar key={m.userId} className='h-5 w-5 ring-2 ring-card'>
                <AvatarImage src={m.profilePic} />
                <AvatarFallback className='text-[8px]'>
                  {m.userName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className='text-[11px] text-muted-foreground'>
            {groupMembers.length} {groupMembers.length === 1 ? 'listener' : 'listeners'}
          </span>
        </div>
      </div>
    </button>
  );
});

/** Solo playback docked at the bottom of the sidebar. Hidden while you're in a room. */
export const NowPlayingDock = memo(({ collapsed }) => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isClosed = usePlayerStore((s) => s.isClosed);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong);
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek);
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const openSheet = useUiStore((s) => s.setPlayerSheetOpen);

  if (!currentSong || isClosed || inRoom || collapsed) return null;

  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className='relative overflow-hidden rounded-2xl border border-border bg-card'>
      <ArtWash src={art} />
      <div className='relative p-2.5'>
        <button
          type='button'
          onClick={() => openSheet(true)}
          className='flex w-full items-center gap-2.5 text-left'
          aria-label={`Open player: ${he.decode(currentSong.name || '')}`}
        >
          <img src={art} alt='' className='h-11 w-11 shrink-0 rounded-lg object-cover shadow-md' />
          <span className='min-w-0'>
            <span className='block truncate text-[13px] font-semibold'>
              {he.decode(currentSong.name || '')}
            </span>
            <span className='block truncate text-xs text-muted-foreground'>
              {he.decode(getArtistName(currentSong, ''))}
            </span>
          </span>
        </button>

        <input
          type='range'
          aria-label='Seek'
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(currentTime || 0, duration || 0)}
          onChange={(e) => handleTimeSeek(Number(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ '--progress': `${progress}%` }}
          className='dock-seek mt-2.5 w-full'
        />

        <div className='mt-1 flex items-center justify-center gap-1'>
          <DockButton label='Previous' onClick={handlePrevSong}>
            <SkipBack className='h-4 w-4' fill='currentColor' />
          </DockButton>
          <button
            type='button'
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className='grid h-9 w-9 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95'
          >
            {isPlaying ? (
              <Pause className='h-4 w-4' fill='currentColor' />
            ) : (
              <Play className='ml-0.5 h-4 w-4' fill='currentColor' />
            )}
          </button>
          <DockButton label='Next' onClick={() => handleNextSong()}>
            <SkipForward className='h-4 w-4' fill='currentColor' />
          </DockButton>
        </div>
      </div>
    </div>
  );
});

const DockButton = ({ label, onClick, children }) => (
  <button
    type='button'
    onClick={onClick}
    aria-label={label}
    className={cn(
      'grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors',
      'hover:bg-foreground/5 hover:text-foreground active:scale-95'
    )}
  >
    {children}
  </button>
);
