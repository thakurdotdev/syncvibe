import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Pause, Plus, QrCode, SkipForward } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { StickyScroll } from '@/components/ui/sticky-scroll-reveal';
import { cn } from '@/lib/utils';
import { DEMO_PLAYLIST } from './demoSong';

const NOW_PLAYING = DEMO_PLAYLIST[0];
const UP_NEXT = [DEMO_PLAYLIST[2], DEMO_PLAYLIST[4]];
const SITE_URL = 'https://syncvibe.thakur.dev';
const LISTENERS = ['Pankaj Thakur', 'Meera'];

const NameScene = () => (
  <div className='flex h-full flex-col justify-center'>
    <p className='text-sm font-medium text-muted-foreground'>Room name</p>
    <p className='font-display mt-2 flex items-center border-b-2 border-foreground pb-3 text-5xl font-bold sm:text-6xl xl:text-7xl'>
      Fun Sunday
      <span className='ml-1.5 inline-block h-[0.85em] w-[3px] animate-pulse bg-foreground motion-reduce:animate-none' />
    </p>
    <p className='mt-6 w-fit rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground'>
      Create room
    </p>
  </div>
);

const FRIENDS = [
  ['Meera', 'Joined'],
  ['Aarav', 'Invited'],
  ['Kabir', null],
];

const InviteScene = () => {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let current = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(SITE_URL, { margin: 1, width: 280 }))
      .then((url) => current && setQr(url))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  return (
    <div className='grid h-full content-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10'>
      <ul className='divide-y divide-foreground/10'>
        {FRIENDS.map(([name, status]) => (
          <li key={name} className='flex items-center gap-3 py-3'>
            <span className='grid h-11 w-11 place-items-center rounded-full bg-background font-semibold'>
              {name[0]}
            </span>
            <span className='flex-1 text-lg font-semibold'>{name}</span>
            {status ? (
              <span className='inline-flex items-center gap-1.5 text-sm text-muted-foreground'>
                <Check size={15} />
                {status}
              </span>
            ) : (
              <span className='rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground'>
                Invite
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className='hidden shrink-0 text-center sm:block'>
        <div className='grid h-40 w-40 place-items-center overflow-hidden rounded-2xl bg-white p-2 xl:h-48 xl:w-48'>
          {qr ? (
            <img src={qr} alt='' className='h-full w-full' />
          ) : (
            <QrCode size={64} className='text-black' />
          )}
        </div>
        <p className='mt-3 flex items-center justify-center gap-1.5 text-sm font-medium'>
          <Copy size={14} />
          Copy room code
        </p>
      </div>
    </div>
  );
};

const FLOATING = [
  ['🔥', '12%', 0.1],
  ['❤️', '24%', 0.45],
  ['👏', '6%', 0.8],
];

const PlayScene = () => (
  <div className='flex h-full flex-col justify-center gap-5'>
    <div className='relative flex items-center gap-5'>
      <img
        src={NOW_PLAYING.cover}
        alt=''
        loading='lazy'
        className='aspect-square w-[38%] max-w-56 rounded-2xl bg-muted object-cover shadow-2xl shadow-scrim/40'
      />
      {FLOATING.map(([emoji, left, delay]) => (
        <motion.span
          key={emoji}
          className='absolute bottom-6 text-3xl'
          style={{ left }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: -110 }}
          transition={{ duration: 1.5, delay, ease: 'easeOut' }}
        >
          {emoji}
        </motion.span>
      ))}
      <div className='min-w-0 flex-1'>
        <p className='font-display truncate text-3xl font-bold xl:text-4xl'>{NOW_PLAYING.name}</p>
        <p className='mt-1 truncate text-sm text-muted-foreground'>{NOW_PLAYING.artists}</p>
        <div className='mt-4 h-1 rounded-full bg-foreground/15'>
          <div className='h-full w-[38%] rounded-full bg-foreground' />
        </div>
        <div className='mt-4 flex items-center gap-2'>
          <span className='grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground'>
            <Pause size={17} fill='currentColor' />
          </span>
          <span className='grid h-9 w-9 place-items-center'>
            <SkipForward size={18} fill='currentColor' />
          </span>
        </div>
      </div>
    </div>

    <div>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-semibold'>Up next</p>
        <span className='grid h-7 w-7 place-items-center rounded-full bg-foreground/10'>
          <Plus size={14} />
        </span>
      </div>
      <ul className='mt-2 divide-y divide-foreground/10'>
        {UP_NEXT.map((song) => (
          <li key={song.id} className='flex items-center gap-3 py-2.5'>
            <img
              src={song.cover}
              alt=''
              loading='lazy'
              className='h-10 w-10 rounded-lg bg-muted object-cover'
            />
            <span className='min-w-0 flex-1'>
              <span className='block truncate text-sm font-semibold'>{song.name}</span>
              <span className='block truncate text-xs text-muted-foreground'>{song.artists}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const SCENES = [NameScene, InviteScene, PlayScene];

const RoomStage = ({ step }) => {
  const Scene = SCENES[step];
  const listeners = LISTENERS.slice(0, step);

  return (
    <div className='bezel h-full' data-step={step} aria-hidden='true'>
      <div className='bezel-inner flex h-full flex-col p-5 sm:p-8 xl:p-10'>
        {/* The stage stays black and white until the music starts. */}
        <motion.img
          src={NOW_PLAYING.cover}
          alt=''
          className='absolute inset-0 -z-10 h-full w-full scale-125 object-cover blur-3xl'
          initial={false}
          animate={{ opacity: step === 2 ? 0.55 : 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        <div className='flex h-9 items-center justify-between gap-3'>
          <p className='flex items-center gap-2 font-semibold'>
            {step === 0 ? 'New room' : 'Fun Sunday'}
            {step === 2 && <span className='text-xs font-semibold text-success'>LIVE</span>}
          </p>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <span className='flex -space-x-2'>
              <AnimatePresence initial={false}>
                {listeners.map((name) => (
                  <motion.span
                    key={name}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                    className='grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-background text-xs font-semibold text-foreground'
                  >
                    {name[0]}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            <span className={cn('tabular-nums', step === 0 && 'invisible')}>
              {listeners.length} listening
            </span>
          </div>
        </div>

        <div className='min-h-0 flex-1 pt-3'>
          <AnimatePresence mode='wait' initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className='h-full'
            >
              <Scene />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const STEPS = [
  {
    title: 'Start a room',
    description: 'Give it a name and create it. Then pick a song to start the room.',
  },
  {
    title: 'Bring your friends',
    description:
      "Invite friends who are online, send them the room code, or let them scan a QR code. They don't need the app; a browser works too.",
  },
  {
    title: 'Play it together',
    description:
      'Everyone in the room can add songs, pause, and skip, and every player follows. Send a reaction when the chorus hits.',
  },
];

const HowItWorks = memo(() => (
  <section id='how-it-works' className='py-14 lg:py-0'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <StickyScroll
        heading={<h2 className='section-title'>Three steps to the same song.</h2>}
        steps={STEPS}
        renderStage={(step) => <RoomStage step={step} />}
      />
    </div>
  </section>
));

HowItWorks.displayName = 'HowItWorks';
export default HowItWorks;
