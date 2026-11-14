import { Laptop, MonitorSpeaker, Smartphone, Volume2 } from 'lucide-react';
import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { resumeAfterTap, transferTo } from '@/lib/player';
import { cn } from '@/lib/utils';
import { usePlayerSessionStore, useRemoteDevice } from '@/stores/playerSessionStore';

/*
 * Which of your devices plays. Every device you're signed in on with the player open is listed;
 * choosing one moves playback there from the same spot.
 */

export const DeviceIcon = ({ device, className }) => {
  const Icon = device.mobile ? Smartphone : Laptop;
  return <Icon className={className} />;
};

const DeviceRow = ({ device, isThis, isPlaying, onPick }) => (
  <button
    type='button'
    onClick={() => onPick(device.deviceId)}
    className={cn(
      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
      'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
      isPlaying && 'bg-accent/60'
    )}
  >
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border',
        isPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}
    >
      <DeviceIcon device={device} className='h-4 w-4' />
    </span>
    <span className='min-w-0 flex-1'>
      <span className='block truncate text-sm font-medium text-foreground'>
        {isThis ? `This browser · ${device.name}` : device.name}
      </span>
      <span className='block truncate text-xs text-muted-foreground'>
        {isPlaying ? 'Playing' : isThis ? 'Play here' : device.mobile ? 'Phone' : 'Browser'}
      </span>
    </span>
    {isPlaying && <Volume2 className='h-4 w-4 shrink-0 text-foreground' />}
  </button>
);

/**
 * The button that opens the list of your devices. `children`, if given, is the trigger instead
 * of the speaker icon (the sidebar uses a line of text).
 */
export const DevicePicker = memo(({ className, children, side = 'top', align = 'end' }) => {
  const [open, setOpen] = useState(false);
  const live = usePlayerSessionStore((s) => s.live);
  const devices = usePlayerSessionStore((s) => s.devices);
  const deviceId = usePlayerSessionStore((s) => s.deviceId);
  const activeId = usePlayerSessionStore((s) => s.playback?.active?.deviceId);
  const remote = useRemoteDevice();

  if (!live) return null;

  // This tab first, then the rest by name.
  const sorted = [...devices].sort((a, b) => {
    if (a.deviceId === deviceId) return -1;
    if (b.deviceId === deviceId) return 1;
    return a.name.localeCompare(b.name);
  });

  const pick = (id) => {
    setOpen(false);
    if (id !== activeId) void transferTo(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            variant='ghost'
            size='icon'
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'h-8.5 w-8.5 rounded-full cursor-pointer transition-colors hover:bg-muted',
              remote ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              className
            )}
            aria-label={remote ? `Playing on ${remote.name}. Choose a device` : 'Choose a device'}
          >
            <MonitorSpeaker size={18} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className='w-72 p-1.5'>
        <p className='px-2.5 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          Play on
        </p>
        <div className='space-y-0.5'>
          {sorted.map((device) => (
            <DeviceRow
              key={device.deviceId}
              device={device}
              isThis={device.deviceId === deviceId}
              isPlaying={device.deviceId === activeId}
              onPick={pick}
            />
          ))}
        </div>
        {sorted.length <= 1 && (
          <p className='px-2.5 pb-1.5 pt-2 text-xs leading-relaxed text-muted-foreground'>
            Open SyncVibe on your phone or another browser, signed in, and it shows up here.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
});
DevicePicker.displayName = 'DevicePicker';

/**
 * Under the controls: which device is playing when it isn't this one, or the tap a browser
 * needs before it will play sound that moved here.
 */
export const PlayingOnNotice = memo(({ className }) => {
  const remote = useRemoteDevice();
  const needsTap = usePlayerSessionStore((s) => s.needsTap);
  const reachable = usePlayerSessionStore((s) => s.playback?.activeOnline !== false);

  if (needsTap) {
    return (
      <div className={cn('flex justify-center', className)}>
        <Button size='sm' onClick={resumeAfterTap} className='gap-2 rounded-full'>
          <Volume2 className='h-4 w-4' />
          Tap to play here
        </Button>
      </div>
    );
  }
  if (!remote) return null;
  return (
    <p
      className={cn(
        'flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground',
        className
      )}
    >
      <DeviceIcon device={remote} className='h-3.5 w-3.5' />
      <span className='truncate'>
        {reachable ? `Playing on ${remote.name}` : `${remote.name} isn't reachable right now`}
      </span>
    </p>
  );
});
PlayingOnNotice.displayName = 'PlayingOnNotice';
