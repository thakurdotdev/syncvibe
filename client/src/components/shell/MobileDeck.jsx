import he from 'he';
import { Radio, WifiOff } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { NextIcon, PauseIcon, PlayIcon, SearchMusicIcon } from '@/components/icons/NavIcons';
import { paths } from '@/lib/paths';
import { transferTo } from '@/lib/player';
import { cn } from '@/lib/utils';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { DeviceIcon } from '@/Pages/Music/BottomPlayer/DevicePicker';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { usePlayingOn } from '@/stores/playerSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { NAV_ITEMS } from './nav';
import { useChatSummary } from './useShellData';

/*
 * The phone layout's bottom deck, the web twin of the app's (app/components/music/
 * UnifiedBottomDeck.tsx): an orb holding what's playing, and a glass pill of tabs.
 *
 * - The orb shows the song's artwork inside its progress ring. Tap opens the player, swipe
 *   sideways skips, hold shows the song. With nothing playing it's the search orb; in a room it
 *   holds the room's song, turning with the room, its ring showing the room's position and the
 *   Rooms badge saying it's the room. Tap takes you back there.
 * - The capsule grows out of the orb over the tabs when the song changes (and on hold): title,
 *   play/pause, next. It closes like a magnet, back into the orb, which ripples as it lands.
 * - When another of your devices plays, the orb wears its icon and the capsule names it. If that
 *   device drops off, the artwork dims and play moves playback here.
 */

const PILL = 58;
const ART = 44;
const RING_R = (PILL - 4) / 2;
const RING_C = 2 * Math.PI * RING_R;
/** How long the capsule stays out on its own, as in the app. */
const SHOW_SONG_MS = 2500;
const HOLD_SONG_MS = 3000;
const HOLD_MS = 420;
const SKIP_DISTANCE = 36;
/** Matches the close below: the ripple starts as the capsule lands. */
const CLOSE_MS = 170;

const titleOf = (song) => (song?.name ? he.decode(song.name) : '');
const artistOf = (song) =>
  he.decode(
    song?.artist_map?.artists
      ?.slice(0, 2)
      .map((a) => a.name)
      .join(', ') || 'Unknown Artist'
  );
const artOf = (song) => song?.image?.[1]?.link || song?.image?.[2]?.link || song?.image?.[0]?.link;

/*
 * The ring round the orb: progress of your song (accent) or the room's (live colour; in Mono the
 * two are the same, so the Rooms badge is what says "a room"). Each change picks its own move:
 * a tick glides, a skip or seek moves there quickly (unwinding to the start on a new song), a
 * song that played to the end lets its finished lap fade while the next starts from the top, and
 * a ring that has just appeared draws round from 12 o'clock.
 */
const RING_MOVE = {
  tick: 'stroke-dashoffset 500ms linear',
  jump: 'stroke-dashoffset 280ms cubic-bezier(0.23, 1, 0.32, 1)',
  draw: 'stroke-dashoffset 480ms cubic-bezier(0.23, 1, 0.32, 1)',
  cut: 'none',
};
const LAP_DONE = 0.97;

const Ring = memo(({ fraction, duration, tone, drawIn, drawDelay }) => {
  const reduceMotion = useReducedMotion();
  const [drawn, setDrawn] = useState(!drawIn);
  useEffect(() => {
    if (drawn) return undefined;
    const timer = setTimeout(() => setDrawn(true), drawDelay);
    return () => clearTimeout(timer);
  }, [drawn, drawDelay]);
  const shown = drawn ? fraction : 0;

  // Which move, worked out while rendering so the change and its transition land together.
  const [last, setLast] = useState({ shown, drawn });
  const [move, setMove] = useState('tick');
  const [lap, setLap] = useState(0);
  if (last.shown !== shown || last.drawn !== drawn) {
    if (last.drawn !== drawn) setMove('draw');
    else if (last.shown >= LAP_DONE && shown < 0.05) {
      setMove('cut');
      setLap((n) => n + 1);
    } else if (shown >= last.shown && (shown - last.shown) * duration < 2.5) setMove('tick');
    else setMove('jump');
    setLast({ shown, drawn });
  }

  const stroke = tone === 'room' ? 'stroke-live' : 'stroke-primary';
  return (
    <svg
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 -rotate-90 transition-opacity duration-150 ease-out'
      style={{ opacity: drawn ? 1 : 0 }}
      width={PILL}
      height={PILL}
      viewBox={`0 0 ${PILL} ${PILL}`}
    >
      <circle
        cx={PILL / 2}
        cy={PILL / 2}
        r={RING_R}
        fill='none'
        strokeWidth={2.5}
        className='stroke-border'
      />
      {lap > 0 && (
        <circle
          key={lap}
          cx={PILL / 2}
          cy={PILL / 2}
          r={RING_R}
          fill='none'
          strokeWidth={2.5}
          className={cn('deck-lap', stroke)}
        />
      )}
      <circle
        cx={PILL / 2}
        cy={PILL / 2}
        r={RING_R}
        fill='none'
        strokeWidth={2.5}
        strokeLinecap='round'
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - shown)}
        // A round cap draws a dot even at zero length.
        strokeOpacity={shown > 0.002 ? 1 : 0}
        className={stroke}
        style={{ transition: reduceMotion ? 'none' : RING_MOVE[move] }}
      />
    </svg>
  );
});
Ring.displayName = 'Ring';

const fractionOf = (time, duration) =>
  duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;

const SongRing = memo((props) => {
  const duration = usePlayerStore((s) => s.duration);
  const fraction = usePlayerStore((s) => fractionOf(s.currentTime, s.duration));
  return <Ring {...props} tone='song' fraction={fraction} duration={duration} />;
});
SongRing.displayName = 'SongRing';

const RoomRing = memo((props) => {
  const duration = useGroupPlaybackStore((s) => s.duration);
  const fraction = useGroupPlaybackStore((s) => fractionOf(s.currentTime, s.duration));
  return <Ring {...props} tone='room' fraction={fraction} duration={duration} />;
});
RoomRing.displayName = 'RoomRing';

/**
 * Playing, the cover turns slowly like a record: it gathers speed over half a second as the music
 * starts, and coasts to a stop on pause, a touch smaller and dimmer. Same timings as the app's orb.
 */
const RECORD_TURN_MS = 8000;
const RECORD_SPIN_UP_MS = 500;
const RECORD_COAST_MS = 600;

const useRecordTurn = (ref, spinning, cover) => {
  const reduceMotion = useReducedMotion();
  const turn = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return undefined;
    // A new song or a room has a new cover element.
    if (turn.current?.effect?.target !== el) {
      turn.current?.cancel();
      turn.current = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: RECORD_TURN_MS,
        iterations: Infinity,
      });
      turn.current.pause();
    }
    const animation = turn.current;
    const running = animation.playState === 'running';
    if (!spinning && !running) {
      animation.pause();
      return undefined;
    }
    // Spinning up, speed rises evenly from where it is to full; coasting down, it eases out.
    const from = running ? animation.playbackRate : 0;
    if (spinning && from >= 1) return undefined;
    if (spinning) animation.play();
    let frame;
    const start = performance.now();
    const step = (now) => {
      if (spinning) {
        const t = Math.min(1, (now - start) / RECORD_SPIN_UP_MS);
        animation.playbackRate = from + (1 - from) * t;
        if (t < 1) frame = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, (now - start) / RECORD_COAST_MS);
      animation.playbackRate = from * (1 - t) ** 3;
      if (t < 1) frame = requestAnimationFrame(step);
      else animation.pause();
    };
    animation.playbackRate = spinning ? Math.max(from, 0.001) : from;
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ref, spinning, reduceMotion, cover]);
  useEffect(() => () => turn.current?.cancel(), []);
};

const glass =
  'border border-border/60 bg-card/75 shadow-[0_8px_24px_hsl(var(--foreground)/0.12)] backdrop-blur-xl';

/** While you hold, a hairline fills round the orb (after a beat, so a tap shows nothing). */
const CHARGE_R = PILL / 2 - 0.7;
const CHARGE_C = 2 * Math.PI * CHARGE_R;
/** Back to full size as the music starts, with a little lift; settling on pause, no lift. */
const PLAY_LIFT = 'scale 360ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 280ms ease-out';
const PAUSE_SETTLE = 'scale 280ms cubic-bezier(0.23, 1, 0.32, 1), opacity 280ms ease-out';

const Orb = memo(
  ({
    kind,
    art,
    title,
    where,
    playing,
    coverId,
    direction,
    expanded,
    entering,
    onTap,
    onHold,
    onSkip,
    ripple,
  }) => {
    const press = useRef(null);
    const record = useRef(null);
    const sheetOpen = useUiStore((s) => s.playerSheetOpen);
    const reduceMotion = useReducedMotion();
    const roomPlaying = useGroupPlaybackStore((s) => s.isPlaying);
    const isPlaying = kind === 'room' ? roomPlaying : kind === 'song' && playing;
    const paused = kind !== 'idle' && !isPlaying;
    // Only while it's in view: the open player covers the orb.
    useRecordTurn(record, kind !== 'idle' && isPlaying && !sheetOpen, `${kind}:${coverId}`);
    const [offset, setOffset] = useState(0);
    const [charging, setCharging] = useState(false);

    // How the next cover comes in: the orb holding something new (music starts, a room, back to
    // your song) opens from the centre; a new song turns in a quarter turn the way it was sent.
    const [seen, setSeen] = useState({ kind, coverId });
    const [enter, setEnter] = useState(null);
    const [kindChanged, setKindChanged] = useState(false);
    const [liveRipple, setLiveRipple] = useState(0);
    if (seen.kind !== kind || seen.coverId !== coverId) {
      if (seen.kind !== kind) {
        setEnter('open');
        setKindChanged(true);
        // Joining a room: one ripple of the live colour.
        if (kind === 'room') setLiveRipple((n) => n + 1);
      } else setEnter(direction);
      setSeen({ kind, coverId });
    }

    const stopCharge = () => setCharging(false);
    const end = () => {
      const current = press.current;
      press.current = null;
      setOffset(0);
      stopCharge();
      if (!current) return;
      clearTimeout(current.timer);
      if (current.held) return;
      if (kind === 'song' && Math.abs(current.dx) >= SKIP_DISTANCE) {
        onSkip(current.dx < 0 ? 'next' : 'prev');
        return;
      }
      if (Math.abs(current.dx) < 8) onTap();
    };

    const label =
      kind === 'idle'
        ? 'Search music'
        : kind === 'room'
          ? 'Back to the room'
          : `Open player: ${title}${where?.label ? `. ${where.label}` : ''}`;
    const drawIn = entering || kindChanged;

    return (
      <button
        type='button'
        aria-label={label}
        className='relative shrink-0 touch-pan-y select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 transition-transform duration-150'
        style={{ width: PILL, height: PILL, WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          const timer =
            kind === 'song'
              ? setTimeout(() => {
                  if (press.current) {
                    press.current.held = true;
                    stopCharge();
                    onHold();
                  }
                }, HOLD_MS)
              : null;
          press.current = { x: e.clientX, dx: 0, held: false, timer };
          if (kind === 'song' && !expanded) setCharging(true);
        }}
        onPointerMove={(e) => {
          const current = press.current;
          if (!current) return;
          current.dx = e.clientX - current.x;
          if (Math.abs(current.dx) > 8) {
            clearTimeout(current.timer);
            stopCharge();
          }
          if (kind === 'song') setOffset(current.dx * 0.5);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          if (press.current) clearTimeout(press.current.timer);
          press.current = null;
          setOffset(0);
          stopCharge();
        }}
        onKeyDown={(e) => {
          if (kind !== 'song') return;
          if (e.key === 'ArrowRight') onSkip('next');
          if (e.key === 'ArrowLeft') onSkip('prev');
        }}
      >
        {/* Behind the orb, so they only show as they spread past the edge. */}
        {ripple > 0 && <span key={`land${ripple}`} aria-hidden='true' className='deck-ripple' />}
        {liveRipple > 0 && (
          <span key={`live${liveRipple}`} aria-hidden='true' className='deck-ripple-live' />
        )}
        <span className={cn('absolute inset-0 grid place-items-center rounded-full', glass)}>
          {kind === 'idle' ? (
            <span
              key='idle'
              className={cn(
                'grid h-full w-full place-items-center rounded-full bg-primary text-primary-foreground',
                kindChanged && 'deck-cover-open'
              )}
            >
              <SearchMusicIcon size={25} />
            </span>
          ) : (
            <>
              {kind === 'song' ? (
                <SongRing key='song' drawIn={drawIn} drawDelay={kindChanged ? 120 : 380} />
              ) : (
                <RoomRing key='room' drawIn={drawIn} drawDelay={kindChanged ? 120 : 380} />
              )}
              {charging && (
                <svg
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 -rotate-90'
                  width={PILL}
                  height={PILL}
                  viewBox={`0 0 ${PILL} ${PILL}`}
                >
                  <circle
                    cx={PILL / 2}
                    cy={PILL / 2}
                    r={CHARGE_R}
                    fill='none'
                    strokeWidth={1.4}
                    strokeLinecap='round'
                    strokeDasharray={CHARGE_C}
                    className='deck-charge stroke-primary'
                    style={{ '--deck-charge-c': CHARGE_C }}
                  />
                </svg>
              )}
              <span
                className={cn(
                  'overflow-hidden rounded-full bg-raised',
                  paused && 'scale-90 opacity-60'
                )}
                style={{
                  width: ART,
                  height: ART,
                  transition: reduceMotion ? 'none' : paused ? PAUSE_SETTLE : PLAY_LIFT,
                }}
              >
                <span
                  key={`${kind}:${coverId}`}
                  className={cn('block h-full w-full', enter && `deck-cover-${enter}`)}
                >
                  <span ref={record} className='block h-full w-full'>
                    {art && (
                      <img
                        src={art}
                        alt=''
                        draggable={false}
                        className={cn(
                          'h-full w-full object-cover',
                          where?.offline && 'brightness-75 grayscale'
                        )}
                        style={{
                          transform: offset ? `translateX(${offset}px)` : undefined,
                          opacity: offset ? Math.max(0.3, 1 - Math.abs(offset) / 40) : 1,
                          transition: offset ? 'none' : 'transform 150ms ease-out, opacity 150ms',
                        }}
                      />
                    )}
                  </span>
                </span>
              </span>
            </>
          )}
        </span>
        {kind === 'song' && where?.remote && (
          <span
            aria-hidden='true'
            className={cn(
              'deck-badge absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background',
              where.offline ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'
            )}
          >
            {where.offline ? (
              <WifiOff className='h-2.5 w-2.5' />
            ) : (
              <DeviceIcon device={where.remote} className='h-2.5 w-2.5' />
            )}
          </span>
        )}
        {kind === 'room' && (
          // The room's badge: the Rooms icon in the theme's live colour.
          <span
            aria-hidden='true'
            className='deck-badge absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-live text-live-foreground'
          >
            <Radio className='h-2.5 w-2.5' strokeWidth={2.75} />
          </span>
        )}
      </button>
    );
  }
);
Orb.displayName = 'Orb';

const Tabs = memo(({ hidden, entering }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { unread } = useChatSummary();
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(pathname));

  return (
    <nav
      aria-label='Main'
      className={cn(
        'relative flex min-w-0 flex-1 items-stretch rounded-full p-[5px] transition-opacity duration-150',
        glass,
        entering && 'deck-rise',
        hidden && 'pointer-events-none opacity-0'
      )}
      // The selected tab's pill, solid so the filled icon's cut-outs can match it exactly.
      style={{
        height: PILL,
        '--deck-tab': 'color-mix(in oklab, hsl(var(--card)) 82%, hsl(var(--primary)))',
      }}
    >
      {activeIndex !== -1 && (
        // The selected tab's pill: tinted with the accent, sliding between tabs.
        <span
          aria-hidden='true'
          className='absolute bottom-[5px] left-[5px] top-[5px] rounded-full bg-(--deck-tab) transition-transform duration-[220ms] ease-in-out motion-reduce:transition-none'
          style={{
            width: `calc((100% - 10px) / ${NAV_ITEMS.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}
      {NAV_ITEMS.map(({ key, label, icon: Icon, path }, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={key}
            type='button'
            onClick={() => navigate(path)}
            aria-label={key === 'messages' && unread > 0 ? `${label}, ${unread} unread` : label}
            aria-current={active ? 'page' : undefined}
            className='relative grid flex-1 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 transition-transform duration-150'
          >
            <span className='relative'>
              <Icon
                size={23}
                filled={active}
                knock='var(--deck-tab)'
                className={cn(
                  'transition-colors duration-200',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              {key === 'rooms' && inRoom && (
                <span className='live-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-live' />
              )}
              {key === 'messages' && unread > 0 && (
                <span className='absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground'>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
Tabs.displayName = 'Tabs';

const Capsule = memo(({ expanded, song, isPlaying, where, onOpen, onPlayPause, onNext }) => (
  <div
    aria-hidden={!expanded}
    className={cn(
      'absolute bottom-0 left-0 z-[1] overflow-hidden rounded-full',
      glass,
      expanded ? 'deck-capsule-open' : 'deck-capsule-closed pointer-events-none'
    )}
    style={{ height: PILL }}
  >
    <div
      className='flex h-full items-center gap-1 pr-2'
      style={{ paddingLeft: PILL + 6, width: 'var(--deck-width)' }}
    >
      {/* Out of the orb on the way in, the title a moment before its controls; out all at once. */}
      <button
        type='button'
        onClick={onOpen}
        tabIndex={expanded ? 0 : -1}
        className={cn(
          'min-w-0 flex-1 text-left outline-none transition-[opacity,translate] ease-out',
          expanded
            ? 'translate-x-0 opacity-100 delay-[60ms] duration-200'
            : '-translate-x-3.5 opacity-0 duration-[60ms]'
        )}
      >
        <p className='truncate text-[13.5px] font-semibold leading-tight text-foreground'>
          {titleOf(song)}
        </p>
        {where?.remote ? (
          <p className='flex items-center gap-1 text-[12px] text-muted-foreground'>
            {where.offline ? (
              <WifiOff className='h-3 w-3 shrink-0' />
            ) : (
              <DeviceIcon device={where.remote} className='h-3 w-3 shrink-0 text-foreground' />
            )}
            <span className='truncate'>{where.label}</span>
          </p>
        ) : (
          <p className='truncate text-[12px] text-muted-foreground'>{artistOf(song)}</p>
        )}
      </button>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 transition-[opacity,translate] ease-out',
          expanded
            ? 'translate-x-0 opacity-100 delay-[120ms] duration-200'
            : '-translate-x-2.5 opacity-0 duration-[60ms]'
        )}
      >
        <button
          type='button'
          onClick={onPlayPause}
          tabIndex={expanded ? 0 : -1}
          aria-label={where?.offline ? 'Play here' : isPlaying ? 'Pause' : 'Play'}
          className='grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground active:scale-90 transition-transform'
        >
          {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button
          type='button'
          onClick={onNext}
          tabIndex={expanded ? 0 : -1}
          aria-label='Next song'
          className='grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground active:scale-90 transition-transform'
        >
          <NextIcon size={22} />
        </button>
      </span>
    </div>
  </div>
));
Capsule.displayName = 'Capsule';

/**
 * Opening the site, the deck rises into place: the tabs first, the orb a beat later. Once per
 * page load.
 */
let deckEntered = false;

export const MobileDeck = memo(() => {
  const navigate = useNavigate();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const roomSong = useGroupPlaybackStore((s) => s.currentSong);
  const sheetOpen = useUiStore((s) => s.playerSheetOpen);
  const setSheetOpen = useUiStore((s) => s.setPlayerSheetOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const { remote, offline, deviceId } = usePlayingOn();
  const where = remote
    ? {
        remote,
        offline,
        label: offline ? `${remote.name} disconnected · paused` : `Playing on ${remote.name}`,
      }
    : null;

  const showSong = !inRoom && !!currentSong;
  const kind = showSong ? 'song' : inRoom ? 'room' : 'idle';
  const song = showSong ? currentSong : inRoom ? roomSong : null;

  const [entering] = useState(() => !deckEntered);
  useEffect(() => {
    deckEntered = true;
  }, []);

  // Which way the song changed, so the orb's new cover turns in from the side it was sent. Only
  // one step back is "previous"; auto-advance and jumps read as next.
  const queueIndex = usePlayerStore((s) =>
    s.currentSong ? s.playlist.findIndex((i) => i.id === s.currentSong?.id) : -1
  );
  const [shownCover, setShownCover] = useState({ id: song?.id, index: queueIndex });
  const [direction, setDirection] = useState('next');
  if (shownCover.id !== song?.id || shownCover.index !== queueIndex) {
    if (shownCover.id !== song?.id) {
      setDirection(queueIndex === shownCover.index - 1 ? 'prev' : 'next');
    }
    setShownCover({ id: song?.id, index: queueIndex });
  }

  const [expanded, setExpanded] = useState(false);
  const [ripple, setRipple] = useState(0);
  const timer = useRef(null);
  const deckRef = useRef(null);

  const expandedRef = useRef(false);
  const collapse = useCallback(() => {
    clearTimeout(timer.current);
    if (!expandedRef.current) return;
    expandedRef.current = false;
    setExpanded(false);
    // The capsule lands back in the orb: a ripple as it arrives.
    setTimeout(() => setRipple((n) => n + 1), CLOSE_MS - 20);
  }, []);
  const expand = useCallback(
    (ms) => {
      clearTimeout(timer.current);
      expandedRef.current = true;
      setExpanded(true);
      timer.current = setTimeout(collapse, ms);
    },
    [collapse]
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  // The capsule's width is the deck's, measured once per resize (not per frame).
  useLayoutEffect(() => {
    const deck = deckRef.current;
    if (!deck) return undefined;
    const update = () => deck.style.setProperty('--deck-width', `${deck.offsetWidth}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(deck);
    return () => observer.disconnect();
  }, []);

  // A new song: the capsule shows it for a moment. Not for the first song shown.
  const shownSong = useRef(song?.id);
  useEffect(() => {
    if (kind !== 'song' || song?.id === shownSong.current) return;
    const first = shownSong.current === undefined;
    shownSong.current = song?.id;
    if (!first && !sheetOpen) expand(SHOW_SONG_MS);
  }, [kind, song?.id, sheetOpen, expand]);

  // The device playing dropped off: say so, since the music just stopped.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (offline && !wasOffline.current && kind === 'song' && !sheetOpen) expand(SHOW_SONG_MS);
    wasOffline.current = offline;
  }, [offline, kind, sheetOpen, expand]);

  // Going anywhere, or opening the player, puts it away.
  const { pathname } = useLocation();
  useEffect(() => {
    collapse();
  }, [pathname, sheetOpen, kind, collapse]);

  const onTap = useCallback(() => {
    if (expanded) collapse();
    else if (kind === 'song') setSheetOpen(true);
    else if (kind === 'room') navigate(paths.rooms);
    else setSearchOpen(true);
  }, [expanded, collapse, kind, setSheetOpen, navigate, setSearchOpen]);

  const onSkip = useCallback((dir) => {
    const player = usePlayerStore.getState();
    if (dir === 'next') player.handleNextSong();
    else player.handlePrevSong();
  }, []);

  return (
    <div
      ref={deckRef}
      className='fixed inset-x-3 z-40 flex items-center gap-2 md:hidden'
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      <div className={cn('relative z-[2] flex', entering && 'deck-pop')}>
        <Orb
          kind={kind}
          coverId={song?.id}
          direction={direction}
          expanded={expanded}
          entering={entering}
          art={artOf(song)}
          title={titleOf(song)}
          where={kind === 'song' ? where : null}
          playing={isPlaying}
          onTap={onTap}
          onHold={() => expand(HOLD_SONG_MS)}
          onSkip={onSkip}
          ripple={ripple}
        />
      </div>
      <Tabs hidden={expanded} entering={entering} />
      {kind === 'song' && (
        <Capsule
          expanded={expanded}
          song={song}
          isPlaying={isPlaying}
          where={where}
          onOpen={() => {
            collapse();
            setSheetOpen(true);
          }}
          onPlayPause={() => {
            // With the playing device gone, the transfer starts sound here inside the tap.
            if (offline) void transferTo(deviceId);
            else usePlayerStore.getState().handlePlayPause();
            expand(SHOW_SONG_MS);
          }}
          onNext={() => {
            usePlayerStore.getState().handleNextSong();
            expand(SHOW_SONG_MS);
          }}
        />
      )}
    </div>
  );
});
MobileDeck.displayName = 'MobileDeck';

export default MobileDeck;
