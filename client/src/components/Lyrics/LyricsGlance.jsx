import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { breakShare, INTRO_MIN_MS, lineAt, LEAD_MS, wordsLit, wordsOf } from './lyricsTiming';

/*
 * Two lines of a song's lyrics under its cover: the one being sung, its words lighting as
 * they're reached, and the next one waiting faintly underneath. When the singer moves on, the
 * sung line lifts away, the waiting one glides up into its place, and the one after arrives
 * word by word. Breaks are three dots that fill across the break and breathe.
 * The app's twin is app/components/music/lyrics/LyricsGlance.tsx.
 */

/** How often the position is read: fine enough for words, cheap enough to leave running. */
const TICK_MS = 100;
/** Space between the sung line and the next one. */
const GAP = 4;
/** A departing line is gone after this; then it's dropped. */
const LEAVE_MS = 600;
/** How bright a word is before it's sung. */
const UNSUNG = 0.4;
/** The waiting line as a whole, over its unsung words: about a quarter in all. */
const WAITING = 0.6;
/** The first word of an arriving line waits for the hand-over to start, the rest follow it. */
const ARRIVE_DELAY_MS = 160;
const ARRIVE_STAGGER_MS = 45;

const RISE =
  'transform 650ms cubic-bezier(.34,1.32,.64,1), opacity 380ms cubic-bezier(.23,1,.32,1)';
const LEAVE = 'transform 460ms cubic-bezier(.23,1,.32,1), opacity 460ms cubic-bezier(.23,1,.32,1)';
const SHIFT = 'transform 300ms cubic-bezier(.23,1,.32,1), opacity 380ms cubic-bezier(.23,1,.32,1)';

/** Type per place: the full player, and a room (two rows, smaller). */
const TYPE = {
  player: { fontSize: 18, lineHeight: 25, rows: 3 },
  room: { fontSize: 15, lineHeight: 21, rows: 2 },
};

export const glanceHeight = (size) => TYPE[size].lineHeight * TYPE[size].rows + GAP;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True from the frame after mount: lets a first style transition to a second. */
const useArrived = (immediate) => {
  const [arrived, setArrived] = useState(immediate);
  useEffect(() => {
    if (arrived) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setArrived(true)));
    return () => cancelAnimationFrame(frame);
  }, [arrived]);
  return arrived;
};

const Word = memo(({ text, lit, delay }) => {
  const arrived = useArrived(delay === null);
  // The arrival delay is for arriving only; lighting up later must not wait for it.
  const [landed, setLanded] = useState(delay === null);
  const bright = lit ? 1 : UNSUNG;
  return (
    <span
      className='inline-block whitespace-pre'
      onTransitionEnd={() => setLanded(true)}
      style={{
        opacity: arrived ? bright : 0,
        // An unsung word sits a hair low and rises as it lights.
        transform: `translateY(${arrived ? (lit ? 0 : 1.5) : 8}px)`,
        transition: 'opacity 300ms ease, transform 340ms cubic-bezier(.23,1,.32,1)',
        transitionDelay: arrived && !landed ? `${delay}ms` : '0ms',
      }}
    >
      {text}
    </span>
  );
});
Word.displayName = 'GlanceWord';

/** A break: three dots that fill across it, breathing while it lasts. */
const Dots = ({ lit, current, center, height }) => (
  <span
    className={cn(
      'flex items-center gap-[7px]',
      center ? 'origin-center justify-center' : 'origin-left',
      current && 'motion-safe:animate-[lyrics-breathe_2.6s_ease-in-out_infinite]'
    )}
    style={{ height }}
  >
    {[0, 1, 2].map((k) => (
      <i
        key={k}
        className='block h-[9px] w-[9px] rounded-full bg-current'
        style={{
          opacity: current && lit > k ? 1 : 0.22,
          transform: `scale(${current && lit > k ? 1 : 0.8})`,
          transition: 'opacity 400ms ease, transform 400ms cubic-bezier(.34,1.56,.64,1)',
        }}
      />
    ))}
  </span>
);

const GlanceLine = memo(
  ({ text, role, arriving, lit, waitingAt, size, center, onCurrentHeight }) => {
    const ref = useRef(null);
    const settled = useArrived(role !== 'current');

    useLayoutEffect(() => {
      if (!ref.current) return;
      if (role === 'current') onCurrentHeight(ref.current.offsetHeight);
    });

    const words = wordsOf(text);
    const { fontSize, lineHeight } = TYPE[size];
    let transform;
    let opacity;
    let transition;
    if (role === 'current') {
      // A line that starts out sung (a new song, a seek) comes up from just below.
      transform = settled ? 'translateY(0)' : 'translateY(8px)';
      opacity = settled ? 1 : 0;
      transition = RISE;
    } else if (role === 'waiting') {
      transform = `translateY(${waitingAt}px)`;
      opacity = WAITING;
      transition = SHIFT;
    } else {
      // A share of its own height, so a two-row line lifts as far as it needs to.
      transform = 'translateY(-70%) scale(0.97)';
      opacity = 0;
      transition = LEAVE;
    }

    return (
      <div
        ref={ref}
        className={cn(
          'absolute inset-x-0 top-0 font-bold tracking-[-0.015em] text-foreground',
          center ? 'origin-center text-center' : 'origin-left',
          // The waiting line keeps to one row; the sung one may wrap.
          role === 'waiting'
            ? cn(
                'overflow-hidden whitespace-nowrap',
                // A line too long for one row fades out at its edge instead of being cut.
                center
                  ? '[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]'
                  : '[mask-image:linear-gradient(to_right,black_82%,transparent)]'
              )
            : cn('flex flex-wrap', center && 'justify-center')
        )}
        style={{
          fontSize,
          lineHeight: `${lineHeight}px`,
          maxHeight: role === 'waiting' ? lineHeight : undefined,
          transform,
          opacity,
          transition: reducedMotion() ? 'none' : transition,
        }}
      >
        {words.length === 0 ? (
          <Dots lit={lit} current={role === 'current'} center={center} height={lineHeight} />
        ) : (
          words.map((word, k) => (
            <Word
              key={k}
              text={word}
              lit={k < lit}
              delay={arriving && !reducedMotion() ? ARRIVE_DELAY_MS + k * ARRIVE_STAGGER_MS : null}
            />
          ))
        )}
      </div>
    );
  }
);
GlanceLine.displayName = 'GlanceLine';

let serial = 0;
const slot = (index, role, arriving) => ({
  key: `${index}-${(serial += 1)}`,
  index,
  role,
  arriving,
});

/** Moves the slots on to line `index`: the sung one leaves, the waiting one (if right) rises. */
const handOver = (slots, index, count) => {
  const kept = slots
    .filter((s) => s.role !== 'leaving')
    .map((s) => (s.role === 'current' ? { ...s, role: 'leaving' } : s));
  const waiting = kept.find((s) => s.role === 'waiting');
  const rises = waiting !== undefined && waiting.index === index;
  // After a seek the waiting line is the wrong one: it leaves too.
  const next = kept
    .filter((s) => s.role === 'leaving' || (s.role === 'waiting' && !rises))
    .map((s) => (s.role === 'waiting' ? { ...s, role: 'leaving' } : s));
  next.push(
    rises ? { ...waiting, role: 'current', arriving: false } : slot(index, 'current', false)
  );
  if (index + 1 < count) next.push(slot(index + 1, 'waiting', true));
  return next;
};

/**
 * The glance. `lines` are a song's timed lyrics; the position (getPosition: () => seconds) is
 * read only while `active`. Clicking it opens the whole song (`onOpen`). `center` lines it up
 * under a centred title.
 */
const LyricsGlance = ({
  lines,
  getPosition,
  active,
  size = 'player',
  center = false,
  onOpen,
  className,
}) => {
  const hasIntro = (lines[0]?.t ?? 0) >= INTRO_MIN_MS;
  const first = hasIntro ? -1 : 0;
  const [at, setAt] = useState({ index: first, lit: 0 });
  const [slots, setSlots] = useState(() => handOver([], first, lines.length));
  const [currentHeight, setCurrentHeight] = useState(TYPE[size].lineHeight);

  // Another song: start again from its top.
  const [linesFor, setLinesFor] = useState(lines);
  if (linesFor !== lines) {
    setLinesFor(lines);
    setAt({ index: first, lit: 0 });
    setSlots(handOver([], first, lines.length));
  }

  useEffect(() => {
    if (!active) return;
    const read = () => {
      const ms = getPosition() * 1000;
      let index = lineAt(lines, ms + LEAD_MS);
      if (index < 0 && !hasIntro) index = 0;
      const text = index >= 0 ? (lines[index]?.text ?? '') : '';
      const lit =
        wordsOf(text).length > 0
          ? wordsLit(lines, index, ms, 0)
          : Math.floor(breakShare(lines, index, ms, 0) * 3.01);
      setAt((prev) => (prev.index === index && prev.lit === lit ? prev : { index, lit }));
    };
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [active, getPosition, hasIntro, lines]);

  // The line changed: hand over.
  const [shownIndex, setShownIndex] = useState(first);
  if (shownIndex !== at.index) {
    setShownIndex(at.index);
    setSlots((prev) => handOver(prev, at.index, lines.length));
  }

  // Lines that have left are dropped once their way out is over.
  const hasLeaving = slots.some((s) => s.role === 'leaving');
  useEffect(() => {
    if (!hasLeaving) return;
    const timer = setTimeout(
      () => setSlots((prev) => prev.filter((s) => s.role !== 'leaving')),
      LEAVE_MS
    );
    return () => clearTimeout(timer);
  }, [hasLeaving, slots]);

  const sung = at.index >= 0 ? lines[at.index]?.text?.trim() : '';
  return (
    <button
      type='button'
      onClick={onOpen}
      aria-label={sung ? `Lyrics: ${sung}. Show all lyrics` : 'Show all lyrics'}
      className={cn(
        'relative block w-full cursor-pointer overflow-hidden text-left',
        'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
      style={{ height: glanceHeight(size) }}
    >
      {slots.map((s) => (
        <GlanceLine
          key={s.key}
          text={s.index >= 0 ? (lines[s.index]?.text ?? '') : ''}
          role={s.role}
          arriving={s.arriving}
          lit={s.role === 'current' ? at.lit : s.role === 'leaving' ? Infinity : 0}
          waitingAt={currentHeight + GAP}
          size={size}
          center={center}
          onCurrentHeight={setCurrentHeight}
        />
      ))}
    </button>
  );
};

export default memo(LyricsGlance);

/** For untimed lyrics: one quiet row that opens them. */
export const PlainLyricsLink = memo(({ lyrics, onOpen, center = false, className }) => {
  const first =
    lyrics.text
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ?? '';
  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'block w-full cursor-pointer space-y-1 rounded-md',
        center ? 'text-center' : 'text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
    >
      <span className='block truncate text-base font-semibold text-foreground/60'>{first}</span>
      <span className='block text-[13px] font-semibold text-muted-foreground'>Read the lyrics</span>
    </button>
  );
});
PlainLyricsLink.displayName = 'PlainLyricsLink';
