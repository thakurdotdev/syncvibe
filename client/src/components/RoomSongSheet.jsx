import he from 'he';
import { ListEnd, ListPlus, LogOut, Radio } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/revola';
import { paths } from '@/lib/paths';
import { playSongs } from '@/lib/playSongs';
import Equalizer from '@/Pages/GroupMusic/components/Equalizer';
import { getArtistName, getSongImage } from '@/Pages/GroupMusic/utils/song';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { setRoomGuard, usePlayerStore } from '@/stores/playerStore';
import { FALLBACK_ART } from './shell/nav';

/*
 * In a room the room plays, so a song you start anywhere else would go nowhere. This asks what
 * to do with it instead: put it on in the room, or leave the room and play it yourself.
 */

const SongLine = ({ song, label, live }) => (
  <div className='flex min-w-0 items-center gap-3'>
    <span className='relative shrink-0'>
      <img
        src={getSongImage(song, 'medium') || FALLBACK_ART}
        alt=''
        className='h-12 w-12 rounded-xl object-cover ring-1 ring-border/60'
      />
      {live && (
        <span className='absolute inset-0 grid place-items-center rounded-xl bg-scrim/40'>
          <Equalizer bars={3} className='h-3' barClassName='w-[2px] bg-on-scrim' />
        </span>
      )}
    </span>
    <span className='min-w-0'>
      <span className='block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
        {label}
      </span>
      <span className='block truncate text-sm font-semibold text-foreground'>
        {he.decode(song?.name || '')}
      </span>
      <span className='block truncate text-xs text-muted-foreground'>
        {he.decode(getArtistName(song, ''))}
      </span>
    </span>
  </div>
);

const Choices = ({ ask, onDone }) => {
  const navigate = useNavigate();
  const { addToQueue, playNext, leaveGroup, canManage } = useGroupMusic();
  const room = useGroupSessionStore((s) => s.currentGroup);
  const roomSong = useGroupPlaybackStore((s) => s.currentSong);
  const roomPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const canAdd = room?.settings?.allowAnyoneToAdd !== false || canManage;
  const { song, list } = ask;

  const leaveAndPlay = () => {
    onDone();
    leaveGroup();
    if (list?.length) playSongs(list);
    else usePlayerStore.getState().playSong(song);
  };

  return (
    <>
      <ResponsiveDialogHeader className='px-5 pt-5 text-left sm:px-6 sm:pt-6'>
        <ResponsiveDialogTitle className='flex items-center gap-2 text-lg'>
          <span className='live-dot h-2 w-2 shrink-0 rounded-full bg-live' />
          <span className='truncate'>You&apos;re in {room?.name || 'a room'}</span>
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription className='text-sm leading-relaxed'>
          {canAdd
            ? 'The room plays for everyone in it, so your own music waits while you’re here. Put this song on in the room, or leave to play it yourself.'
            : 'The room plays for everyone in it, so your own music waits while you’re here. Only the hosts add songs in this room.'}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className='space-y-4 px-5 pb-5 pt-1 sm:px-6 sm:pb-6'>
        <div className='bezel'>
          <div className='bezel-inner space-y-3 p-3'>
            <SongLine song={song} label='You picked' />
            {roomSong && (
              <>
                <div className='hairline-glow' />
                <SongLine song={roomSong} label='Playing in the room' live={roomPlaying} />
              </>
            )}
          </div>
        </div>

        {canAdd && (
          <div className='flex gap-2'>
            <Button
              className='min-w-0 flex-1 gap-2'
              onClick={() => {
                playNext(song);
                onDone();
              }}
            >
              <ListPlus className='h-4 w-4 shrink-0 max-[359px]:hidden' />
              <span className='truncate'>Play next</span>
            </Button>
            <Button
              variant='outline'
              className='min-w-0 flex-1 gap-2'
              onClick={() => {
                addToQueue(song);
                onDone();
              }}
            >
              <ListEnd className='h-4 w-4 shrink-0 max-[359px]:hidden' />
              <span className='truncate'>Add to queue</span>
            </Button>
          </div>
        )}

        <div className='flex gap-2'>
          <Button
            variant='ghost'
            className='min-w-0 flex-1 gap-2'
            onClick={() => {
              onDone();
              navigate(paths.rooms);
            }}
          >
            <Radio className='h-4 w-4 shrink-0 max-[359px]:hidden' />
            <span className='truncate'>Go to the room</span>
          </Button>
          <Button variant='ghost' className='min-w-0 flex-1 gap-2' onClick={leaveAndPlay}>
            <LogOut className='h-4 w-4 shrink-0 max-[359px]:hidden' />
            <span className='truncate'>Leave and play</span>
          </Button>
        </div>
      </div>
    </>
  );
};

const RoomSongSheet = () => {
  const [ask, setAsk] = useState(null);

  useEffect(() => {
    setRoomGuard((song, list) => {
      if (!song?.id || !useGroupSessionStore.getState().currentGroup) return false;
      setAsk({ song, list });
      return true;
    });
    return () => setRoomGuard(null);
  }, []);

  // Leaving the room some other way while this is open: nothing left to ask.
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const open = Boolean(ask) && inRoom;

  return (
    <ResponsiveDialog open={open} onOpenChange={(next) => !next && setAsk(null)}>
      <ResponsiveDialogContent className='max-h-[90%] p-0 sm:max-w-[440px]'>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {ask && <Choices ask={ask} onDone={() => setAsk(null)} />}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

export default memo(RoomSongSheet);
