import { memo, useEffect, useState } from 'react';
import { Laptop, Loader2, Radio, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Equalizer from './components/Equalizer';
import { getArtistName, getSongImage } from './utils/song';

/** Long enough for a slow join; after it the button works again if nothing came of it. */
const SWITCH_TIMEOUT_MS = 8000;

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

const RoomCard = ({ room, switching, disabled, onPlayHere }) => {
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
          onClick={() => onPlayHere(room.groupId)}
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

/**
 * Your rooms playing on another device, with a button to move each one here. Moving it is an
 * ordinary join: the server hands the room to this device and tells the other one to stop.
 */
const PlayingElsewhere = ({ rooms, onPlayHere }) => {
  const [switchingId, setSwitchingId] = useState(null);

  useEffect(() => {
    if (!switchingId) return;
    const timer = setTimeout(() => setSwitchingId(null), SWITCH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [switchingId]);

  if (rooms.length === 0) return null;

  const playHere = (groupId) => {
    setSwitchingId(groupId);
    onPlayHere(groupId);
  };

  return (
    <section aria-label='Your rooms on other devices' className='mb-10 w-full space-y-3'>
      {rooms.map((room) => (
        <RoomCard
          key={room.groupId}
          room={room}
          switching={switchingId === room.groupId}
          disabled={Boolean(switchingId)}
          onPlayHere={playHere}
        />
      ))}
    </section>
  );
};

export default memo(PlayingElsewhere);
