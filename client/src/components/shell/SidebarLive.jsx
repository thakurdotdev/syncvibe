import he from 'he';
import { MonitorSpeaker, Pause, Play, Plus, SkipForward, WifiOff } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { paths } from '@/lib/paths';
import { transferTo } from '@/lib/player';
import { cn } from '@/lib/utils';
import { DeviceIcon, DevicePicker } from '@/Pages/Music/BottomPlayer/DevicePicker';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { getArtistName, getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { usePlayingOn } from '@/stores/playerSessionStore';
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
  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const groupMembers = useGroupSessionStore((s) => s.groupMembers) ?? [];
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;
  const listeners = `${groupMembers.length} in the room`;

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
      <div className='relative flex items-center justify-between gap-2 px-3 pt-2.5'>
        <span className='flex items-center gap-1.5 text-[11px] font-semibold text-live'>
          <span className='live-dot h-1.5 w-1.5 rounded-full bg-live' />
          Your room
        </span>
        <span
          className='flex items-center gap-1.5 text-[11px] text-muted-foreground'
          title={`${groupMembers.length} in this room`}
        >
          <span className='flex -space-x-1.5'>
            {groupMembers.slice(0, 3).map((m) => (
              <Avatar key={m.userId} className='h-4 w-4 ring-[1.5px] ring-card'>
                <AvatarImage src={m.profilePic} />
                <AvatarFallback className='text-[7px]'>
                  {m.userName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
          <span className='tabular-nums'>{groupMembers.length} here</span>
        </span>
      </div>
      <div className='relative flex items-center gap-3 p-2.5 pt-2'>
        <div className='relative h-11 w-11 shrink-0 overflow-hidden rounded-xl'>
          <img src={art} alt='' className='h-full w-full object-cover' />
          {isPlaying && (
            <div className='absolute inset-0 grid place-items-center bg-scrim/35'>
              <Equalizer bars={3} className='h-3' barClassName='bg-card' />
            </div>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-[13px] font-semibold'>{currentGroup.name}</p>
          <p className='truncate text-xs text-muted-foreground'>
            {currentSong ? he.decode(currentSong.name || '') : 'Queue is empty'}
          </p>
        </div>
      </div>
    </button>
  );
};

/** Progress lives in its own components so only they re-render on every time update. */
const useProgress = () => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return { currentTime, duration, progress };
};

const MiniProgress = () => {
  const { progress } = useProgress();
  return (
    <span className='absolute inset-x-0 bottom-0 h-[3px] bg-scrim/40'>
      <span
        className='block h-full origin-left bg-primary'
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </span>
  );
};

const SeekBar = () => {
  const { currentTime, duration, progress } = useProgress();
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek);
  return (
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
  );
};

const PlayingOnStrip = ({ remote, offline, onPlayHere }) =>
  offline ? (
    <div className='relative flex items-center gap-1.5 border-b border-border bg-muted/60 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground'>
      <WifiOff className='h-3.5 w-3.5 shrink-0' />
      <span className='min-w-0 flex-1 truncate'>
        {remote.name} disconnected <span className='font-normal'>· paused</span>
      </span>
    </div>
  ) : (
    <div className='relative flex items-center gap-1.5 border-b border-border bg-muted/60 py-1.5 pl-2.5 pr-1.5 text-[11px] font-semibold'>
      <span className='live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-live' />
      <DeviceIcon device={remote} className='h-3.5 w-3.5 shrink-0' />
      <DevicePicker side='right' align='start'>
        <button
          type='button'
          className='min-w-0 flex-1 truncate text-left hover:underline'
          aria-label={`Playing on ${remote.name}. Choose a device`}
        >
          Playing on {remote.name}
        </button>
      </DevicePicker>
      <button
        type='button'
        onClick={onPlayHere}
        className='shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold transition-colors hover:bg-accent'
      >
        Play here
      </button>
    </div>
  );

const PlayerCard = ({ collapsed }) => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const openSheet = useUiStore((s) => s.setPlayerSheetOpen);
  const { remote, offline, deviceId, deviceCount } = usePlayingOn();

  const art = getSongImage(currentSong, 'medium') || FALLBACK_ART;
  const title = he.decode(currentSong.name || '');
  const playHere = () => void transferTo(deviceId);
  // With the playing device gone, play means "here": the transfer starts sound inside the click.
  const onPlayPause = offline ? playHere : handlePlayPause;
  const where = remote
    ? offline
      ? `${remote.name} disconnected, paused`
      : `Playing on ${remote.name}`
    : null;

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={onPlayPause}
        aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}${where ? `. ${where}` : ''}`}
        title={where ? `${title} · ${where}` : title}
        className='group relative mx-auto block h-10 w-10'
      >
        <span className='relative block h-full w-full overflow-hidden rounded-xl'>
          <img
            src={art}
            alt=''
            className={cn('h-full w-full object-cover', offline && 'brightness-75 grayscale')}
          />
          <span className='absolute inset-0 grid place-items-center bg-scrim/40 text-on-scrim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
            {isPlaying ? (
              <Pause className='h-4 w-4' fill='currentColor' />
            ) : (
              <Play className='h-4 w-4' fill='currentColor' />
            )}
          </span>
          {isPlaying && !remote && (
            <span className='absolute bottom-1 left-1 group-hover:hidden'>
              <Equalizer bars={3} className='h-2.5' barClassName='w-[2px] bg-card' />
            </span>
          )}
          <MiniProgress />
        </span>
        {remote && (
          <span
            className={cn(
              'absolute -bottom-1.5 -right-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-sidebar',
              offline ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'
            )}
          >
            {offline ? (
              <WifiOff className='h-2.5 w-2.5' />
            ) : (
              <DeviceIcon device={remote} className='h-2.5 w-2.5' />
            )}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card',
        remote && !offline ? 'border-foreground/35' : 'border-border'
      )}
    >
      <ArtWash src={art} />
      {remote && <PlayingOnStrip remote={remote} offline={offline} onPlayHere={playHere} />}
      <div className='relative flex items-center gap-2.5 p-2.5 pb-1'>
        <button
          type='button'
          onClick={() => openSheet(true)}
          aria-label={`Open player: ${title}`}
          className='flex min-w-0 flex-1 items-center gap-2.5 text-left'
        >
          <span className='relative shrink-0'>
            <img
              src={art}
              alt=''
              className={cn(
                'h-11 w-11 rounded-xl object-cover',
                offline && 'brightness-75 grayscale'
              )}
            />
            {remote && !offline && (
              <span className='absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-foreground text-background'>
                <DeviceIcon device={remote} className='h-3 w-3' />
              </span>
            )}
          </span>
          <span className='min-w-0'>
            <span className='block truncate text-[13px] font-semibold'>{title}</span>
            <span className='block truncate text-xs text-muted-foreground'>
              {he.decode(getArtistName(currentSong, ''))}
            </span>
          </span>
        </button>
        <button
          type='button'
          onClick={onPlayPause}
          aria-label={offline ? 'Play here' : isPlaying ? 'Pause' : 'Play'}
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
      <SeekBar />
      {!remote && deviceCount > 1 && (
        <DevicePicker side='right' align='end'>
          <button
            type='button'
            className='relative -mt-0.5 mb-1.5 ml-1 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground'
          >
            <MonitorSpeaker className='h-3.5 w-3.5' />
            This browser · {deviceCount} devices
          </button>
        </DevicePicker>
      )}
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
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong));

  if (inRoom) return <RoomCard collapsed={collapsed} />;
  if (hasSong) return <PlayerCard collapsed={collapsed} />;
  return <StartRoom collapsed={collapsed} />;
});
