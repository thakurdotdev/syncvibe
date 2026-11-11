import { memo, useEffect, useState } from 'react';
import { Laptop, Loader2, Radio, Smartphone, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Equalizer from './components/Equalizer';
import { TimeAgo } from '@/Utils/TimeAgo';
import { getArtistName, getSongImage } from './utils/song';

/** Long enough for a slow join; after it the buttons work again if nothing came of it. */
const JOIN_TIMEOUT_MS = 8000;

const DeviceLine = ({ device, playing }) => {
  if (!device) {
    return (
      <span className='flex items-center gap-1.5 text-muted-foreground'>
        <WifiOff className='h-3.5 w-3.5 shrink-0' />
        Your other device is offline
      </span>
    );
  }
  const Icon = device.mobile ? Smartphone : Laptop;
  return (
    <span className='flex min-w-0 items-center gap-1.5'>
      <Icon className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
      <span className='truncate'>
        <span className='text-muted-foreground'>{playing ? 'Playing on ' : 'Paused on '}</span>
        <span className='font-medium text-foreground'>{device.name}</span>
      </span>
    </span>
  );
};

/** A room you're in, playing on another device of yours. */
const PlayingCard = ({ room, switching, disabled, onJoin }) => {
  const { song, device, playing } = room;
  const image = getSongImage(song, 'medium');

  return (
    <div className='bezel w-full'>
      <div className='bezel-inner flex flex-col gap-4 p-4 sm:flex-row sm:items-center'>
        <div className='flex min-w-0 flex-1 items-center gap-3.5'>
          <div className='relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted'>
            {image ? (
              <img src={image} alt='' className='h-full w-full object-cover' />
            ) : (
              <span className='flex h-full w-full items-center justify-center text-muted-foreground'>
                <Radio className='h-5 w-5' />
              </span>
            )}
            {playing && device && (
              <span className='absolute inset-0 flex items-end justify-center bg-scrim/35 pb-2'>
                <Equalizer bars={3} className='h-3' barClassName='bg-on-scrim' />
              </span>
            )}
          </div>

          <div className='min-w-0 flex-1 space-y-0.5 text-left'>
            <p className='truncate text-sm font-semibold' title={song?.name || room.name}>
              {song?.name || room.name}
            </p>
            <p className='truncate text-xs text-muted-foreground'>
              {song
                ? [getArtistName(song, ''), room.name].filter(Boolean).join(' · ')
                : 'Nothing playing yet'}
            </p>
            <div className='pt-1 text-xs'>
              <DeviceLine device={device} playing={playing} />
            </div>
          </div>
        </div>

        <Button
          onClick={() => onJoin(room.groupId)}
          disabled={disabled}
          className='w-full shrink-0 rounded-full sm:w-auto'
          aria-label={`Play ${room.name} on this device`}
        >
          {switching && <Loader2 className='animate-spin' />}
          {switching ? 'Moving…' : 'Play here'}
        </Button>
      </div>
    </div>
  );
};

/** A room you left lately. */
const LeftRoomRow = ({ room, switching, disabled, onJoin, onDismiss }) => (
  <div className='surface-card flex items-center gap-3 rounded-2xl bg-card/60 p-3 pl-3.5'>
    <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground'>
      <Radio className='h-[18px] w-[18px]' />
    </span>
    <div className='min-w-0 flex-1 text-left'>
      <p className='truncate text-sm font-semibold' title={room.name}>
        {room.name}
      </p>
      <p className='truncate text-xs text-muted-foreground'>
        {room.full ? 'Room is full' : `Left ${TimeAgo(room.leftAt).toLowerCase()}`}
      </p>
    </div>
    <Button
      variant='outline'
      size='sm'
      onClick={() => onJoin(room.groupId)}
      disabled={disabled || room.full}
      className='shrink-0 rounded-full'
      aria-label={`Rejoin ${room.name}`}
    >
      {switching && <Loader2 className='animate-spin' />}
      {switching ? 'Joining…' : 'Rejoin'}
    </Button>
    <Button
      variant='ghost'
      size='icon'
      onClick={() => onDismiss(room.groupId)}
      className='h-8 w-8 shrink-0 rounded-full text-muted-foreground'
      aria-label={`Don't show ${room.name} again`}
    >
      <X />
    </Button>
  </div>
);

/**
 * Ways back into your rooms: one playing on another device can be moved here, and one you left
 * lately rejoined. Both are an ordinary join; for a room you're in, the server hands it to this
 * device and tells the other one to stop.
 */
const MyRooms = ({ rooms, onJoin, onDismiss }) => {
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    if (!joiningId) return;
    const timer = setTimeout(() => setJoiningId(null), JOIN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [joiningId]);

  if (rooms.length === 0) return null;

  const join = (groupId) => {
    setJoiningId(groupId);
    onJoin(groupId);
  };

  return (
    <section aria-label='Your rooms' className='mb-10 w-full space-y-3'>
      {rooms.map((room) => {
        const props = {
          room,
          switching: joiningId === room.groupId,
          disabled: Boolean(joiningId),
          onJoin: join,
        };
        return room.status === 'member' ? (
          <PlayingCard key={room.groupId} {...props} />
        ) : (
          <LeftRoomRow key={room.groupId} {...props} onDismiss={onDismiss} />
        );
      })}
    </section>
  );
};

export default memo(MyRooms);
