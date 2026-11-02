import he from 'he';
import { Pause, Play, Plus, SkipForward } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { getArtistName, getSongImage } from '@/Pages/GroupMusic/utils/song';
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

const RoomCard = ({ collapsed }) => {
  const navigate = useNavigate();
  const { currentGroup, currentSong, isPlaying, groupMembers = [] } = useGroupMusic();
  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;
  const listeners = `${groupMembers.length} listening`;

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={() => navigate(paths.rooms)}
        title={`${currentGroup.name}, ${listeners}`}
        aria-label={`Open room ${currentGroup.name}`}
        className='relative mx-auto block h-10 w-10 rounded-xl ring-2 ring-live ring-offset-2 ring-offset-sidebar'
      >
        <img src={art} alt='' className='h-full w-full rounded-xl object-cover' />
        <span className='live-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-live' />
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={() => navigate(paths.rooms)}
      className='relative block w-full overflow-hidden rounded-2xl border border-live/35 bg-card text-left transition-colors hover:border-live/70'
    >
      <ArtWash src={art} />
      <div className='relative flex items-center gap-3 p-2.5'>
        <div className='relative h-11 w-11 shrink-0 overflow-hidden rounded-xl'>
          <img src={art} alt='' className='h-full w-full object-cover' />
          {isPlaying && (
            <div className='absolute inset-0 grid place-items-center bg-black/35'>
              <Equalizer bars={3} className='h-3' barClassName='bg-white' />
            </div>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='flex items-center gap-1.5 text-[11px] font-semibold text-live'>
            <span className='live-dot h-1.5 w-1.5 rounded-full bg-live' />
            {listeners}
          </p>
          <p className='truncate text-[13px] font-semibold'>{currentGroup.name}</p>
          <p className='truncate text-xs text-muted-foreground'>
            {currentSong ? he.decode(currentSong.name || '') : 'Queue is empty'}
          </p>
        </div>
        <div className='hidden shrink-0 -space-x-1.5 [@media(min-height:700px)]:flex'>
          {groupMembers.slice(0, 2).map((m) => (
            <Avatar key={m.userId} className='h-5 w-5 ring-2 ring-card'>
              <AvatarImage src={m.profilePic} />
              <AvatarFallback className='text-[8px]'>
                {m.userName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </button>
  );
};

const PlayerCard = ({ collapsed }) => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek);
  const openSheet = useUiStore((s) => s.setPlayerSheetOpen);

  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;
  const title = he.decode(currentSong.name || '');
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={handlePlayPause}
        aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        title={title}
        className='group relative mx-auto block h-10 w-10 overflow-hidden rounded-xl'
      >
        <img src={art} alt='' className='h-full w-full object-cover' />
        <span className='absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
          {isPlaying ? (
            <Pause className='h-4 w-4' fill='currentColor' />
          ) : (
            <Play className='h-4 w-4' fill='currentColor' />
          )}
        </span>
        {isPlaying && (
          <span className='absolute bottom-1 left-1 group-hover:hidden'>
            <Equalizer bars={3} className='h-2.5' barClassName='w-[2px] bg-white' />
          </span>
        )}
        <span className='absolute inset-x-0 bottom-0 h-[3px] bg-black/40'>
          <span className='block h-full bg-primary' style={{ width: `${progress}%` }} />
        </span>
      </button>
    );
  }

  return (
    <div className='relative overflow-hidden rounded-2xl border border-border bg-card'>
      <ArtWash src={art} />
      <div className='relative flex items-center gap-2.5 p-2.5 pb-1'>
        <button
          type='button'
          onClick={() => openSheet(true)}
          aria-label={`Open player: ${title}`}
          className='flex min-w-0 flex-1 items-center gap-2.5 text-left'
        >
          <img src={art} alt='' className='h-11 w-11 shrink-0 rounded-xl object-cover' />
          <span className='min-w-0'>
            <span className='block truncate text-[13px] font-semibold'>{title}</span>
            <span className='block truncate text-xs text-muted-foreground'>
              {he.decode(getArtistName(currentSong, ''))}
            </span>
          </span>
        </button>
        <button
          type='button'
          onClick={handlePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95'
        >
          {isPlaying ? (
            <Pause className='h-4 w-4' fill='currentColor' />
          ) : (
            <Play className='ml-0.5 h-4 w-4' fill='currentColor' />
          )}
        </button>
        <button
          type='button'
          onClick={() => handleNextSong()}
          aria-label='Next song'
          className='-ml-1 grid h-8 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-95'
        >
          <SkipForward className='h-4 w-4' fill='currentColor' />
        </button>
      </div>
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
        className='dock-seek relative block w-full px-2.5 pb-1'
      />
    </div>
  );
};

const StartRoom = ({ collapsed }) => {
  const navigate = useNavigate();
  return (
    <button
      type='button'
      onClick={() => navigate(paths.rooms)}
      aria-label={collapsed ? 'Start a room' : undefined}
      title={collapsed ? 'Start a room' : undefined}
      className={cn(
        'group flex items-center rounded-2xl text-left transition-colors',
        collapsed
          ? 'mx-auto h-10 w-10 justify-center border border-dashed border-border text-muted-foreground hover:border-live hover:text-live'
          : 'w-full gap-3 border border-dashed border-border p-2.5 hover:border-live/60'
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-xl transition-colors',
          collapsed
            ? ''
            : 'h-10 w-10 bg-live/15 text-live group-hover:bg-live group-hover:text-live-foreground'
        )}
      >
        <Plus className='h-4 w-4' />
      </span>
      {!collapsed && (
        <span className='min-w-0'>
          <span className='block text-[13px] font-semibold'>Start a room</span>
          <span className='block truncate text-xs text-muted-foreground'>
            Listen in sync with friends
          </span>
        </span>
      )}
    </button>
  );
};

/**
 * The one "what's happening now" slot pinned above the profile: your live room if you're in
 * one, otherwise solo playback, otherwise an invitation to start a room.
 */
export const NowSlot = memo(({ collapsed }) => {
  const inRoom = Boolean(useGroupMusic().currentGroup);
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong) && !s.isClosed);

  if (inRoom) return <RoomCard collapsed={collapsed} />;
  if (hasSong) return <PlayerCard collapsed={collapsed} />;
  return <StartRoom collapsed={collapsed} />;
});
