import { Laptop, MonitorSpeaker, Smartphone, Volume2, WifiOff } from 'lucide-react';
import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { resumeAfterTap, transferTo } from '@/lib/player';
import { cn } from '@/lib/utils';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { usePlayerSessionStore, usePlayingOn, useRemoteDevice } from '@/stores/playerSessionStore';

/*
 * Which of your devices plays. Every device you're signed in on with the player open is listed;
 * choosing one moves playback there from the same spot.
 */

export const DeviceIcon = ({ device, className }) => {
  const Icon = device.mobile ? Smartphone : Laptop;
  return <Icon className={className} />;
};

const kindOf = (device) => (device.mobile ? 'Phone' : 'Browser');

/** The device that plays, at the top of the list: what it's doing, not a choice. */
const ActiveDevice = ({ device, isThis, playing, offline }) => (
  <div className='bezel'>
    <div className='bezel-inner flex items-center gap-3 p-2.5'>
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          offline ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'
        )}
      >
        {offline ? (
          <WifiOff className='h-4.5 w-4.5' />
        ) : (
          <DeviceIcon device={device} className='h-4.5 w-4.5' />
        )}
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold text-foreground'>
          {isThis ? 'This browser' : device.name}
        </span>
        <span className='block truncate text-xs text-muted-foreground'>
          {offline
            ? 'Disconnected · paused'
            : `${isThis ? device.name : kindOf(device)} · ${playing ? 'Playing' : 'Paused'}`}
        </span>
      </span>
      {playing && !offline ? (
        <Equalizer bars={3} className='h-3.5 shrink-0' barClassName='bg-foreground' />
      ) : (
        <Volume2 className='h-4 w-4 shrink-0 text-muted-foreground' />
      )}
    </div>
  </div>
);

const DeviceRow = ({ device, isThis, onPick }) => (
  <button
    type='button'
    onClick={() => onPick(device.deviceId)}
    className='group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none cursor-pointer'
  >
    <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-muted text-muted-foreground transition-colors group-hover:text-foreground'>
      <DeviceIcon device={device} className='h-4 w-4' />
    </span>
    <span className='min-w-0 flex-1'>
      <span className='block truncate text-sm font-medium text-foreground'>
        {isThis ? 'This browser' : device.name}
      </span>
      <span className='block truncate text-xs text-muted-foreground'>
        {isThis ? device.name : kindOf(device)}
      </span>
    </span>
    <span className='shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground opacity-70 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
      {isThis ? 'Play here' : 'Play there'}
    </span>
  </button>
);

/** Only this device so far: how another one shows up. */
const OnlyThisOne = () => (
  <div className='px-2.5 pb-2 pt-3 text-center'>
    <span className='mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground'>
      <MonitorSpeaker className='h-5 w-5' />
    </span>
    <p className='mt-2 text-sm font-medium text-foreground'>Only this browser for now</p>
    <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
      Open SyncVibe on your phone or in another browser, signed in, and you can play there from
      here.
    </p>
  </div>
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
  const active = usePlayerSessionStore((s) => s.playback?.active ?? null);
  const playing = usePlayerSessionStore((s) => Boolean(s.playback?.timeline?.playing));
  const { remote, offline } = usePlayingOn();

  if (!live) return null;

  // The device playing on top; the rest with this tab first, then by name.
  const activeId = active?.deviceId;
  const activeDevice = activeId ? (devices.find((d) => d.deviceId === activeId) ?? active) : null;
  const others = devices
    .filter((d) => d.deviceId !== activeId)
    .sort((a, b) => {
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
              'relative h-8.5 w-8.5 rounded-full cursor-pointer transition-colors hover:bg-muted',
              remote
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
              className
            )}
            aria-label={remote ? `Playing on ${remote.name}. Choose a device` : 'Choose a device'}
          >
            <MonitorSpeaker size={18} />
            {devices.length > 1 && (
              <span className='absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9.5px] font-semibold text-primary-foreground tabular-nums'>
                {devices.length}
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className='w-76 p-2'>
        {activeDevice && (
          <>
            <p className='px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Playing on
            </p>
            <ActiveDevice
              device={activeDevice}
              isThis={activeId === deviceId}
              playing={playing}
              offline={offline}
            />
          </>
        )}
        {others.length > 0 ? (
          <>
            <p className='px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
              {activeDevice ? 'Move it to' : 'Play on'}
            </p>
            <div className='space-y-0.5'>
              {others.map((device) => (
                <DeviceRow
                  key={device.deviceId}
                  device={device}
                  isThis={device.deviceId === deviceId}
                  onPick={pick}
                />
              ))}
            </div>
          </>
        ) : (
          devices.length <= 1 && <OnlyThisOne />
        )}
      </PopoverContent>
    </Popover>
  );
});
DevicePicker.displayName = 'DevicePicker';

/**
 * Under the controls: which device is playing when it isn't this one, with the way to bring it
 * here, or the tap a browser needs before it will play sound that moved here.
 */
export const PlayingOnNotice = memo(({ className }) => {
  const remote = useRemoteDevice();
  const needsTap = usePlayerSessionStore((s) => s.needsTap);
  const { offline, deviceId } = usePlayingOn();

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
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-full border py-1.5 pl-3 pr-1.5',
        offline ? 'border-border bg-muted/60' : 'border-foreground/25 bg-foreground/[0.06]',
        className
      )}
    >
      {offline ? (
        <WifiOff className='h-4 w-4 shrink-0 text-muted-foreground' />
      ) : (
        <span className='relative grid shrink-0 place-items-center'>
          <DeviceIcon device={remote} className='h-4 w-4 text-foreground' />
          <span className='live-dot absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-live' />
        </span>
      )}
      <span className='min-w-0 flex-1 truncate text-xs font-medium text-foreground'>
        {offline ? (
          <>
            {remote.name} disconnected <span className='text-muted-foreground'>· paused</span>
          </>
        ) : (
          <>
            <span className='text-muted-foreground'>Playing on </span>
            {remote.name}
          </>
        )}
      </span>
      <Button
        size='sm'
        variant='outline'
        onClick={() => void transferTo(deviceId)}
        className='h-7 shrink-0 rounded-full px-3 text-xs'
      >
        Play here
      </Button>
    </div>
  );
});
PlayingOnNotice.displayName = 'PlayingOnNotice';
