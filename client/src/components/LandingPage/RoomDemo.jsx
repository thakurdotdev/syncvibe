import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import {
  ArrowUp,
  Bookmark,
  Disc3,
  GripVertical,
  Headphones,
  House,
  Image as ImageIcon,
  Library,
  ListMusic,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  RadioTower,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DEMO_PLAYLIST } from './demoSong';

const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'];
const START_AT = 73;
const SOURCE_LABEL = { laptop: 'the laptop', phone: 'the phone', friend: "a friend's phone" };

const formatTime = (seconds) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** One shared room state. Every screen reads this, which is what the demo is showing off. */
export const useDemoRoom = (stageRef) => {
  const inView = useInView(stageRef);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [activity, setActivity] = useState(null);
  const [reactions, setReactions] = useState([]);
  const seconds = useMotionValue(START_AT);
  const duration = useMotionValue(DEMO_PLAYLIST[0].duration);
  const time = useTransform(seconds, formatTime);
  const progress = useTransform([seconds, duration], ([s, d]) => `${(s / d) * 100}%`);

  const goTo = (nextIndex) => {
    setIndex(nextIndex);
    seconds.set(0);
    duration.set(DEMO_PLAYLIST[nextIndex].duration);
  };

  useAnimationFrame((_, delta) => {
    if (!playing || !inView) return;
    const next = seconds.get() + delta / 1000;
    if (next >= duration.get()) goTo((index + 1) % DEMO_PLAYLIST.length);
    else seconds.set(next);
  });

  const togglePlay = (source) => {
    setActivity(`${playing ? 'Paused' : 'Played'} from ${SOURCE_LABEL[source]}`);
    setPlaying(!playing);
  };

  const skip = (source, step = 1) => {
    const nextIndex = (index + step + DEMO_PLAYLIST.length) % DEMO_PLAYLIST.length;
    goTo(nextIndex);
    setPlaying(true);
    setActivity(`Skipped from ${SOURCE_LABEL[source]}`);
  };

  const react = (emoji) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((current) => [...current.slice(-7), { id, emoji, x: 8 + Math.random() * 76 }]);
    setTimeout(() => setReactions((current) => current.filter((r) => r.id !== id)), 1500);
  };

  return {
    song: DEMO_PLAYLIST[index],
    queue: DEMO_PLAYLIST.map((_, i) => DEMO_PLAYLIST[(index + 1 + i) % DEMO_PLAYLIST.length]).slice(
      0,
      -1
    ),
    playing,
    activity,
    reactions,
    time,
    progress,
    togglePlay,
    skip,
    react,
  };
};

/** Scales a fixed-size screen to fit its column, so phone and laptop keep their proportions. */
const FitScreen = ({ width, height, className, children }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className={cn('relative w-full', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className='absolute left-0 top-0 origin-top-left'
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
};

const FloatingReactions = ({ reactions }) => {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div className='pointer-events-none absolute inset-0 z-20 overflow-hidden' aria-hidden='true'>
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.span
            key={reaction.id}
            className='absolute bottom-[42%] text-3xl'
            style={{ left: `${reaction.x}%` }}
            initial={{ opacity: 0, y: 40, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -170, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          >
            {reaction.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

const SignalBars = () => (
  <span className='inline-flex items-end gap-[2px] text-success' aria-hidden='true'>
    <span className='h-1.5 w-[3px] rounded-sm bg-current' />
    <span className='h-2.5 w-[3px] rounded-sm bg-current' />
    <span className='h-3.5 w-[3px] rounded-sm bg-current' />
  </span>
);

const RoundButton = ({ label, onClick, className, children }) => (
  <button
    type='button'
    aria-label={label}
    onClick={onClick}
    className={cn('press grid shrink-0 cursor-pointer place-items-center rounded-full', className)}
  >
    {children}
  </button>
);

const PlayButton = ({ room, source, size }) => (
  <RoundButton
    label={`${room.playing ? 'Pause' : 'Play'} on ${SOURCE_LABEL[source]}`}
    onClick={() => room.togglePlay(source)}
    className={cn(
      "relative bg-primary text-primary-foreground before:absolute before:-inset-3 before:content-[''] hover:bg-primary-hover",
      size
    )}
  >
    {room.playing ? (
      <Pause size={18} fill='currentColor' />
    ) : (
      <Play size={18} fill='currentColor' />
    )}
  </RoundButton>
);

const SkipButton = ({ room, source }) => (
  <RoundButton
    label={`Next song on ${SOURCE_LABEL[source]}`}
    onClick={() => room.skip(source)}
    className='h-9 w-9 text-foreground hover:bg-foreground/10'
  >
    <SkipForward size={18} fill='currentColor' />
  </RoundButton>
);

const SeekBar = ({ room }) => (
  <div>
    <div className='h-1 overflow-hidden rounded-full bg-foreground/15'>
      <motion.div className='h-full rounded-full bg-foreground' style={{ width: room.progress }} />
    </div>
    <div className='mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums'>
      <motion.span>{room.time}</motion.span>
      <span>{formatTime(room.song.duration)}</span>
    </div>
  </div>
);

const ReactionRow = ({ room, source }) => (
  <div className='flex gap-1'>
    {REACTIONS.map((emoji) => (
      <button
        key={emoji}
        type='button'
        aria-label={`Send ${emoji} from ${SOURCE_LABEL[source]}`}
        onClick={() => room.react(emoji)}
        className='press h-7 flex-1 cursor-pointer rounded-lg bg-foreground/8 text-sm hover:bg-foreground/15'
      >
        {emoji}
      </button>
    ))}
  </div>
);

const BlurredArt = ({ src }) => (
  <div className='absolute inset-0 -z-10 overflow-hidden' aria-hidden='true'>
    <img src={src} alt='' className='h-full w-full scale-125 object-cover opacity-25 blur-2xl' />
  </div>
);

const ChatFeed = ({ room, className }) => (
  <div className={cn('flex min-h-0 flex-col justify-end gap-2 overflow-hidden', className)}>
    <p className='self-start rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[13px]'>
      <span className='block text-[11px] font-semibold text-muted-foreground'>Pankaj Thakur</span>
      Hello Guysssssss
    </p>
    <p className='self-end rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-primary-foreground'>
      turn it up 😅
    </p>
    <AnimatePresence initial={false}>
      {room.activity && (
        <motion.p
          key={room.activity}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className='text-center text-[11px] text-muted-foreground'
        >
          {room.activity}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

const Composer = () => (
  <div className='flex items-center gap-1.5' aria-hidden='true'>
    <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold'>
      GIF
    </span>
    <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted'>
      <Volume2 size={14} />
    </span>
    <span className='min-w-0 flex-1 truncate rounded-full bg-muted px-3 py-2 text-[13px] text-muted-foreground'>
      Message the room
    </span>
    <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground'>
      <ArrowUp size={15} />
    </span>
  </div>
);

export const PhoneRoom = ({ room, source = 'phone', className }) => (
  <FitScreen width={320} height={660} className={className}>
    <div className='relative h-full w-full overflow-hidden rounded-[2.4rem] border-[6px] border-raised bg-background text-foreground shadow-2xl shadow-scrim/25'>
      <FloatingReactions reactions={room.reactions} />
      <div className='flex h-full flex-col px-3 pt-5'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-display flex items-center gap-2 text-2xl leading-tight font-bold'>
              Fun Sunday
              <SignalBars />
            </p>
            <p className='mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
              <span className='h-1.5 w-1.5 rounded-full bg-foreground' />2 listening
            </p>
          </div>
          <div className='flex gap-1.5' aria-hidden='true'>
            <span className='grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground'>
              <UserPlus size={15} />
            </span>
            <span className='grid h-9 w-9 place-items-center rounded-full bg-muted'>
              <MoreHorizontal size={15} />
            </span>
          </div>
        </div>

        <div className='isolate relative mt-3 flex overflow-hidden rounded-3xl border border-border/60 bg-card'>
          <BlurredArt src={room.song.cover} />
          <img src={room.song.cover} alt='' className='w-[34%] shrink-0 bg-muted object-cover' />
          <div className='min-w-0 flex-1 space-y-2 p-2.5'>
            <div className='flex items-center gap-1'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-semibold'>{room.song.name}</p>
                <p className='truncate text-[11px] text-muted-foreground'>{room.song.artists}</p>
                <p className='truncate text-[11px] font-medium'>Added by {room.song.addedBy}</p>
              </div>
              <PlayButton room={room} source={source} size='h-10 w-10' />
              <SkipButton room={room} source={source} />
            </div>
            <SeekBar room={room} />
            <ReactionRow room={room} source={source} />
          </div>
        </div>

        <div
          className='mt-3 flex rounded-xl bg-muted p-1 text-xs font-medium text-muted-foreground'
          aria-hidden='true'
        >
          <span className='flex-1 rounded-lg bg-background py-1.5 text-center font-semibold text-foreground'>
            Chat
          </span>
          <span className='flex-1 py-1.5 text-center'>Queue 10</span>
          <span className='flex-1 py-1.5 text-center'>People 2</span>
        </div>

        <ChatFeed room={room} className='flex-1 py-3' />
        <Composer />

        <div
          className='-mx-3 mt-2 flex justify-around border-t border-border px-1 pt-2 pb-3 text-[10px] text-muted-foreground'
          aria-hidden='true'
        >
          {[
            [House, 'Home'],
            [Headphones, 'Rooms', true],
            [Music2, 'Library'],
            [MessageCircle, 'Messages'],
          ].map(([Icon, label, active]) => (
            <span
              key={label}
              className={cn(
                'flex flex-col items-center gap-0.5',
                active && 'font-semibold text-foreground'
              )}
            >
              <Icon size={18} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  </FitScreen>
);

const LAPTOP_NAV = [
  [Disc3, 'Listen'],
  [RadioTower, 'Rooms', true],
  [MessageCircle, 'Messages'],
  [Library, 'Library'],
];

const LaptopSidebar = ({ song }) => (
  <div className='flex w-[180px] shrink-0 flex-col p-3 text-[13px]' aria-hidden='true'>
    <span className='font-display mb-3 px-2 text-base font-bold'>SyncVibe</span>
    <span className='flex items-center gap-2.5 px-2 py-2 text-muted-foreground'>
      <Search size={16} />
      Search
    </span>
    {LAPTOP_NAV.map(([Icon, label, active]) => (
      <span
        key={label}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted-foreground',
          active && 'border border-border bg-background font-semibold text-foreground'
        )}
      >
        <Icon size={16} />
        <span className='flex-1'>{label}</span>
        {active && <span className='text-[10px]'>Live</span>}
      </span>
    ))}

    <span className='mt-4 border-t border-border px-2 pt-3 text-xs text-muted-foreground'>
      Playlists
    </span>
    {['Late Night Fun', 'Dance'].map((name) => (
      <span key={name} className='flex items-center gap-2.5 px-2 py-1.5'>
        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted'>
          <ListMusic size={13} />
        </span>
        <span className='truncate text-xs font-medium'>{name}</span>
      </span>
    ))}

    <span className='mt-auto rounded-xl border border-border bg-card p-2.5'>
      <span className='block text-[11px] font-semibold'>Your room</span>
      <span className='mt-2 flex items-center gap-2'>
        <img src={song.cover} alt='' className='h-9 w-9 rounded-lg bg-muted object-cover' />
        <span className='min-w-0'>
          <span className='block truncate text-xs font-semibold'>Fun Sunday</span>
          <span className='block truncate text-[11px] text-muted-foreground'>{song.name}</span>
        </span>
      </span>
    </span>
  </div>
);

const LaptopNowPlaying = ({ room }) => (
  <div className='flex gap-4 rounded-2xl border border-border/60 bg-card/40 p-3.5'>
    <img
      src={room.song.cover}
      alt=''
      className='h-[108px] w-[108px] shrink-0 rounded-xl bg-muted object-cover shadow-lg shadow-scrim/25'
    />
    <div className='min-w-0 flex-1'>
      <p className='truncate font-display text-[26px] leading-tight font-bold'>{room.song.name}</p>
      <p className='truncate text-xs text-muted-foreground'>
        {room.song.artists}, added by {room.song.addedBy}
      </p>

      <div className='mt-2 flex items-center gap-2.5 text-[11px] text-muted-foreground tabular-nums'>
        <motion.span>{room.time}</motion.span>
        <div className='relative h-1 flex-1 rounded-full bg-foreground/15'>
          <motion.div
            className='relative h-full rounded-full bg-foreground'
            style={{ width: room.progress }}
          >
            <span className='absolute top-1/2 right-0 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground' />
          </motion.div>
        </div>
        <span>{formatTime(room.song.duration)}</span>
      </div>

      <div className='mt-1.5 flex items-center gap-1'>
        <RoundButton
          label='Previous song on the laptop'
          onClick={() => room.skip('laptop', -1)}
          className='h-8 w-8 text-foreground hover:bg-foreground/10'
        >
          <SkipBack size={15} />
        </RoundButton>
        <PlayButton room={room} source='laptop' size='h-10 w-10' />
        <SkipButton room={room} source='laptop' />

        <div className='mx-auto flex gap-0.5'>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              aria-label={`Send ${emoji} from ${SOURCE_LABEL.laptop}`}
              onClick={() => room.react(emoji)}
              className='press h-8 w-8 cursor-pointer rounded-lg text-base hover:bg-foreground/10'
            >
              {emoji}
            </button>
          ))}
        </div>

        <span className='flex items-center gap-2 text-muted-foreground' aria-hidden='true'>
          <Volume2 size={15} />
          <span className='h-1 w-20 rounded-full bg-foreground' />
        </span>
      </div>
    </div>
  </div>
);

const LaptopQueue = ({ queue }) => (
  <div
    className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-3'
    aria-hidden='true'
  >
    <div className='flex items-center justify-between text-xs font-medium text-muted-foreground'>
      <span className='flex rounded-lg bg-muted p-1'>
        <span className='rounded-md bg-background px-2.5 py-1 font-semibold text-foreground'>
          Up next 10
        </span>
        <span className='px-2.5 py-1'>Playlists</span>
        <span className='px-2.5 py-1'>For you</span>
      </span>
      <span className='flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-foreground'>
        <Sparkles size={12} />
        Autoplay
      </span>
    </div>
    <span className='mt-2.5 flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground'>
      <Search size={13} />
      Search songs to add
    </span>
    <span className='mt-1.5 flex min-h-0 flex-1 flex-col'>
      {queue.map((song) => (
        <span key={song.id} className='flex shrink-0 items-center gap-3 py-1.5 pr-1'>
          <GripVertical size={14} className='text-muted-foreground/60' />
          <img src={song.cover} alt='' className='h-9 w-9 rounded-lg bg-muted object-cover' />
          <span className='min-w-0 flex-1'>
            <span className='flex items-center gap-1.5 text-[13px] font-medium'>
              <span className='truncate'>{song.name}</span>
              {song.addedBy === 'Autoplay' && (
                <span className='shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold'>
                  Auto
                </span>
              )}
            </span>
            <span className='block truncate text-[11px] text-muted-foreground'>{song.artists}</span>
          </span>
          <span className='grid h-5 w-5 place-items-center rounded-full bg-muted text-[9px] font-semibold'>
            {song.addedBy[0]}
          </span>
          <Bookmark size={14} className='text-muted-foreground' />
          <Trash2 size={14} className='text-muted-foreground' />
        </span>
      ))}
    </span>
  </div>
);

const LaptopChat = ({ room }) => (
  <div className='flex w-[270px] shrink-0 flex-col rounded-2xl border border-border/60 bg-card/40 p-2.5'>
    <div
      className='flex rounded-xl bg-muted p-1 text-xs font-medium text-muted-foreground'
      aria-hidden='true'
    >
      <span className='flex-1 rounded-lg bg-background py-1.5 text-center font-semibold text-foreground'>
        Chat
      </span>
      <span className='flex-1 py-1.5 text-center'>People 2</span>
    </div>
    <div
      className='mt-2 flex items-center justify-between text-[11px] text-muted-foreground'
      aria-hidden='true'
    >
      <span>Tap a message to react</span>
      <span className='rounded-full bg-muted px-2 py-0.5 font-medium text-foreground'>SFX</span>
    </div>
    <ChatFeed room={room} className='flex-1 py-3' />
    <div
      className='flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-[13px] text-muted-foreground'
      aria-hidden='true'
    >
      <ImageIcon size={14} />
      <Volume2 size={14} />
      <span className='truncate'>Message the group</span>
    </div>
  </div>
);

// Follows the layout of the real web room, so the demo and the screenshots lower down agree.
export const LaptopRoom = ({ room, className }) => (
  <FitScreen width={1200} height={667} className={className}>
    <div className='relative h-[645px] w-full overflow-hidden rounded-t-2xl border-[6px] border-b-0 border-raised bg-canvas text-foreground'>
      <FloatingReactions reactions={room.reactions} />
      <div className='flex h-full'>
        <LaptopSidebar song={room.song} />
        <div className='relative isolate my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background p-3'>
          <BlurredArt src={room.song.cover} />
          <div className='flex items-center justify-between pb-2.5 pl-1' aria-hidden='true'>
            <span className='flex items-center gap-2'>
              <span className='font-display text-lg font-bold'>Fun Sunday</span>
              <SignalBars />
              <span className='text-[11px] font-semibold text-success'>LIVE</span>
            </span>
            <span className='flex items-center gap-3 text-xs text-muted-foreground'>
              2 listening
              <span className='flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground'>
                <UserPlus size={13} />
                Invite
              </span>
            </span>
          </div>
          <div className='flex min-h-0 flex-1 gap-2.5'>
            <div className='flex min-w-0 flex-1 flex-col gap-2.5'>
              <LaptopNowPlaying room={room} />
              <LaptopQueue queue={room.queue} />
            </div>
            <LaptopChat room={room} />
          </div>
        </div>
      </div>
    </div>
    <div className='mx-auto h-[22px] w-full rounded-b-xl bg-raised' aria-hidden='true' />
  </FitScreen>
);

/** The full-bleed line under the devices: one playhead, however many screens are in the room. */
export const SharedPlayhead = ({ room }) => (
  <div className='relative h-0.5 w-full bg-foreground/15'>
    <motion.div className='relative h-full bg-foreground' style={{ width: room.progress }}>
      <span
        className={cn(
          'absolute top-1/2 right-0 h-3.5 w-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground transition-transform duration-200',
          !room.playing && 'scale-75'
        )}
      />
    </motion.div>
    <span className='sr-only' aria-live='polite'>
      {room.activity}
    </span>
  </div>
);
