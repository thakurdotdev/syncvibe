import he from 'he';
import { ArrowRight, LogOut } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { getArtistName, getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { FALLBACK_ART } from '@/components/shell/nav';

const Card = ({ onClose }) => {
  const navigate = useNavigate();
  const { leaveGroup } = useGroupMusic();
  const room = useGroupSessionStore((s) => s.currentGroup);
  const listeners = useGroupSessionStore((s) => s.groupMembers?.length ?? 0);
  const song = useGroupPlaybackStore((s) => s.currentSong);
  const playing = useGroupPlaybackStore((s) => s.isPlaying);

  return (
    <div className='bezel w-full min-w-0 max-w-sm'>
      <div className='bezel-inner p-4 text-center sm:p-5'>
        <span className='relative mx-auto block h-20 w-20'>
          <img
            src={getSongImage(song, 'medium') || FALLBACK_ART}
            alt=''
            className='h-full w-full rounded-2xl object-cover ring-1 ring-border/60'
          />
          {playing && (
            <span className='absolute inset-0 grid place-items-center rounded-2xl bg-scrim/40'>
              <Equalizer bars={4} className='h-4' barClassName='bg-on-scrim' />
            </span>
          )}
        </span>
        <p className='mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
          <span className='live-dot h-1.5 w-1.5 rounded-full bg-live' />
          {listeners} in the room
        </p>
        <h2 className='mt-1 truncate text-lg font-semibold text-foreground'>
          Playing in {room?.name || 'your room'}
        </h2>
        <p className='mt-1 truncate text-sm text-muted-foreground'>
          {song
            ? `${he.decode(song.name || '')} · ${he.decode(getArtistName(song, ''))}`
            : 'Nothing playing yet'}
        </p>
        <p className='mt-3 text-xs leading-relaxed text-muted-foreground'>
          Your own music is paused while you&apos;re in a room. Leave the room to carry on with it.
        </p>
        <div className='mt-4 flex gap-2'>
          <Button
            className='min-w-0 flex-1 gap-1.5 px-3'
            onClick={() => {
              onClose();
              navigate(paths.rooms);
            }}
          >
            <span className='truncate'>Open room</span>
            <ArrowRight className='h-4 w-4 shrink-0 max-[359px]:hidden' />
          </Button>
          <Button variant='outline' className='min-w-0 flex-1 gap-1.5 px-3' onClick={leaveGroup}>
            <LogOut className='h-4 w-4 shrink-0 max-[359px]:hidden' />
            <span className='truncate'>Leave room</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Over your own player while you're in a room: the room is what's playing, so its controls
 * would do nothing. Says so, with the way to the room and the way out of it.
 */
const RoomCover = memo(({ onClose }) => {
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  if (!inRoom) return null;
  return (
    <div className='absolute inset-0 z-[28] flex items-center justify-center bg-background/75 px-4 backdrop-blur-md'>
      <Card onClose={onClose} />
    </div>
  );
});
RoomCover.displayName = 'RoomCover';

export default RoomCover;
