import he from 'he';
import { WifiOff } from 'lucide-react';
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
 *   holds the room's song and takes you back there.
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

/** The thin ring of progress round the orb's artwork. */
const ProgressRing = memo(() => {
  const fraction = usePlayerStore((s) =>
    s.duration > 0 ? Math.min(1, Math.max(0, s.currentTime / s.duration)) : 0
  );
  return (
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
        r={RING_R}
        fill='none'
        strokeWidth={2.5}
        className='stroke-border'
      />
      <circle
        cx={PILL / 2}
        cy={PILL / 2}
        r={RING_R}
        fill='none'
        strokeWidth={2.5}
        strokeLinecap='round'
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - fraction)}
        className='stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear'
      />
    </svg>
  );
});
ProgressRing.displayName = 'ProgressRing';

/**
 * Playing, the cover turns slowly like a record; paused, it coasts to a stop, a touch smaller and
 * dimmer. Same timings as the app's orb.
 */
const RECORD_TURN_MS = 8000;
const RECORD_COAST_MS = 600;

const useRecordTurn = (ref, spinning) => {
  const reduceMotion = useReducedMotion();
  const turn = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return undefined;
    // The cover's element is new after the orb showed a room or search instead.
    if (turn.current?.effect?.target !== el) {
      turn.current?.cancel();
      turn.current = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: RECORD_TURN_MS,
        iterations: Infinity,
      });
      turn.current.pause();
    }
    const animation = turn.current;
    if (spinning) {
      animation.playbackRate = 1;
      animation.play();
      return undefined;
    }
    if (animation.playState !== 'running') {
      animation.pause();
      return undefined;
    }
    // Slows from full speed to nothing (ease-out), then holds where it stopped.
    let frame;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / RECORD_COAST_MS);
      animation.playbackRate = (1 - t) ** 3;
      if (t < 1) frame = requestAnimationFrame(step);
      else animation.pause();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ref, spinning, reduceMotion]);
  useEffect(() => () => turn.current?.cancel(), []);
};

const glass =
  'border border-border/60 bg-card/75 shadow-[0_8px_24px_hsl(var(--foreground)/0.12)] backdrop-blur-xl';

const Orb = memo(({ kind, art, title, where, playing, onTap, onHold, onSkip, ripple }) => {
  const press = useRef(null);
  const record = useRef(null);
  const sheetOpen = useUiStore((s) => s.playerSheetOpen);
  const paused = kind === 'song' && !playing;
  // Only while it's in view: the open player covers the orb.
  useRecordTurn(record, kind === 'song' && playing && !sheetOpen);
  const [offset, setOffset] = useState(0);

  const end = () => {
    const current = press.current;
    press.current = null;
    setOffset(0);
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
                  onHold();
                }
              }, HOLD_MS)
            : null;
        press.current = { x: e.clientX, dx: 0, held: false, timer };
      }}
      onPointerMove={(e) => {
        const current = press.current;
        if (!current) return;
        current.dx = e.clientX - current.x;
        if (Math.abs(current.dx) > 8) clearTimeout(current.timer);
        if (kind === 'song') setOffset(current.dx * 0.5);
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
        setOffset(0);
      }}
      onKeyDown={(e) => {
        if (kind !== 'song') return;
        if (e.key === 'ArrowRight') onSkip('next');
        if (e.key === 'ArrowLeft') onSkip('prev');
      }}
    >
      {/* Behind the orb, so it only shows as it spreads past the edge. */}
      {ripple > 0 && <span key={ripple} aria-hidden='true' className='deck-ripple' />}
      <span className={cn('absolute inset-0 grid place-items-center rounded-full', glass)}>
        {kind === 'idle' ? (
          <span className='grid h-full w-full place-items-center rounded-full bg-primary text-primary-foreground'>
            <SearchMusicIcon size={25} />
          </span>
        ) : (
          <>
            {kind === 'song' && <ProgressRing />}
            <span
              ref={record}
              className={cn(
                'overflow-hidden rounded-full bg-raised transition-[opacity,scale] duration-300 ease-out motion-reduce:transition-none',
                paused && 'scale-90 opacity-60'
              )}
              style={{ width: ART, height: ART }}
            >
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
          </>
        )}
      </span>
      {kind === 'song' && where?.remote && (
        <span
          aria-hidden='true'
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background',
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
    </button>
  );
});
Orb.displayName = 'Orb';

const Tabs = memo(({ hidden }) => {
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
      className={cn(
        'flex h-full items-center gap-1 pr-2 transition-opacity',
        expanded ? 'opacity-100 delay-75 duration-150' : 'opacity-0 duration-[60ms]'
      )}
      style={{ paddingLeft: PILL + 6, width: 'var(--deck-width)' }}
    >
      <button
        type='button'
        onClick={onOpen}
        tabIndex={expanded ? 0 : -1}
        className='min-w-0 flex-1 text-left outline-none'
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
    </div>
  </div>
));
Capsule.displayName = 'Capsule';

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
      <div className='relative z-[2] flex'>
        <Orb
          kind={kind}
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
      <Tabs hidden={expanded} />
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
