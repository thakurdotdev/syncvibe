import { MoreHorizontal, Radio } from 'lucide-react';
import { memo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useForgetSavedRoom, useSavedRooms } from '@/hooks/useSavedRooms';
import { cn } from '@/lib/utils';
import { getInitial } from './utils/song';

/** Up to four covers from the last queue, or a quiet placeholder. */
const Covers = ({ covers }) => {
  if (covers.length === 0) {
    return (
      <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:h-14 sm:w-14'>
        <Radio className='h-5 w-5' />
      </span>
    );
  }
  const tiles = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  return (
    <span
      className={cn(
        'grid h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 sm:h-14 sm:w-14',
        tiles.length === 4 && 'grid-cols-2'
      )}
    >
      {tiles.map((src) => (
        <img key={src} src={src} alt='' className='h-full w-full object-cover' loading='lazy' />
      ))}
    </span>
  );
};

const Regulars = ({ room }) => {
  if (room.regularCount === 0) return <span className='block truncate'>Just you so far</span>;
  const names = room.regulars.slice(0, 2).map((r) => r.userName.split(' ')[0]);
  const more = room.regularCount - names.length;
  return (
    <span className='flex min-w-0 items-center gap-1.5'>
      <span className='flex shrink-0 -space-x-1.5'>
        {room.regulars.slice(0, 3).map((r) => (
          <Avatar key={r.userId} className='h-4 w-4 ring-2 ring-card'>
            <AvatarImage src={r.profilePic} className='object-cover' />
            <AvatarFallback className='bg-accent text-[8px]'>
              {getInitial(r.userName)}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className='truncate'>
        With {names.join(', ')}
        {more > 0 ? ` +${more}` : ''}
      </span>
    </span>
  );
};

const SavedRoomCard = ({ room, busy, disabled, onOpen, onForget }) => (
  <li className='surface-card flex items-center gap-2.5 rounded-2xl bg-card/60 p-2.5 sm:gap-3 sm:p-3'>
    <Covers covers={room.covers} />
    <div className='min-w-0 flex-1 text-left'>
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <span className='truncate' title={room.name}>
          {room.name}
        </span>
        {room.live && (
          <span className='inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary'>
            <span className='h-1.5 w-1.5 rounded-full bg-primary' />
            Live<span className='hidden sm:inline'> · {room.live.listeners}</span>
          </span>
        )}
      </p>
      <p className='mt-0.5 truncate text-xs text-muted-foreground'>
        {room.songCount > 0
          ? `${room.songCount} ${room.songCount === 1 ? 'song' : 'songs'} queued`
          : 'No songs yet'}
      </p>
      <div className='mt-1 text-xs text-muted-foreground'>
        <Regulars room={room} />
      </div>
    </div>
    <Button
      size='sm'
      onClick={() => onOpen(room)}
      disabled={disabled}
      className='shrink-0 rounded-full px-3 sm:px-4'
      aria-label={room.live ? `Join ${room.name}` : `Open ${room.name}`}
    >
      {busy ? 'Opening…' : room.live ? 'Join' : 'Open'}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='-ml-1 h-8 w-7 shrink-0 rounded-full text-muted-foreground sm:w-8'
          aria-label={`More for ${room.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onSelect={() => onForget(room.id)} className='text-destructive'>
          Stop keeping this room
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </li>
);

/**
 * Rooms you keep between sessions. Opening one starts it again as you left it (name, settings,
 * co-hosts, last queue, paused), or joins it if someone kept it going.
 */
const SavedRooms = ({ onOpen }) => {
  const { data: rooms = [] } = useSavedRooms();
  const forget = useForgetSavedRoom();
  const [openingId, setOpeningId] = useState(null);

  if (rooms.length === 0) return null;

  return (
    <section aria-label='Kept rooms' className='mb-10 w-full'>
      <h3 className='mb-2.5 px-1 text-left text-xs font-medium text-muted-foreground'>
        Kept rooms
      </h3>
      <ul className='space-y-2.5'>
        {rooms.map((room) => (
          <SavedRoomCard
            key={room.id}
            room={room}
            busy={openingId === room.id}
            disabled={openingId !== null}
            onOpen={(r) => {
              setOpeningId(r.id);
              onOpen(r);
              // Opening ends by leaving this screen; if nothing came of it, offer it again.
              setTimeout(() => setOpeningId(null), 8000);
            }}
            onForget={(id) => forget.mutate(id)}
          />
        ))}
      </ul>
    </section>
  );
};

export default memo(SavedRooms);
