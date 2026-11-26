import { MicVocal } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '@/Context/Context';
import { useLyrics, usePrefetchLyrics, useReportLyrics } from '@/hooks/useLyrics';
import { cn } from '@/lib/utils';

/** How often the position is read while the lyrics are on screen. */
const TICK_MS = 200;
/** A line lights up this much before its time: it reads as on the beat, not late. */
const LEAD_MS = 250;
/** After you scroll the lyrics yourself, they stay where you put them this long. */
const HOLD_AFTER_SCROLL_MS = 3500;
/** Where the current line sits, as a share of the view's height from the top. */
const FOCUS_AT = 0.32;

const SOURCE_NAME = { lrclib: 'LRCLIB', saavn: 'JioSaavn' };

/** The last line whose time has come, by binary search; -1 before the first. */
export const lineAt = (lines, ms) => {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Placeholder = ({ size }) => (
  <div className='space-y-4 px-1 pt-3' aria-label='Loading lyrics'>
    {['72%', '58%', '84%', '46%', '66%'].map((width) => (
      <div
        key={width}
        className={cn(
          'animate-pulse rounded-lg bg-foreground/[0.07]',
          size === 'large' ? 'h-6' : 'h-4'
        )}
        style={{ width }}
      />
    ))}
  </div>
);

const Empty = ({ failed, onRetry }) => (
  <div className='flex h-full flex-col items-center justify-center gap-2.5 p-6 text-center'>
    <MicVocal className='h-6 w-6 text-muted-foreground' strokeWidth={1.6} aria-hidden='true' />
    <p className='text-sm font-medium text-foreground'>
      {failed ? "Couldn't load lyrics" : 'No lyrics for this song yet'}
    </p>
    {failed && (
      <button
        type='button'
        onClick={onRetry}
        className='cursor-pointer text-sm font-medium text-primary hover:underline'
      >
        Try again
      </button>
    )}
  </div>
);

const Footer = ({ lyrics, songId }) => {
  const { user } = useProfile();
  const report = useReportLyrics(songId);
  const source = SOURCE_NAME[lyrics.source] ?? lyrics.source;
  return (
    <div className='mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
      <span>
        {lyrics.kind === 'plain' ? 'Not timed · ' : ''}Lyrics from {source}
      </span>
      {user?.userid && (
        <button
          type='button'
          onClick={() => report.mutate()}
          disabled={report.isPending}
          className='cursor-pointer underline underline-offset-2 hover:text-foreground disabled:cursor-default disabled:no-underline'
        >
          {report.isPending ? 'Looking again…' : 'Wrong lyrics?'}
        </button>
      )}
    </div>
  );
};

/**
 * A song's lyrics. Timed ones follow the song: the current line is lit and kept a third of the
 * way down, unless you've just scrolled; clicking a line plays from there (when `onSeek` is
 * given). Untimed ones are plain text. The position is read only while `active`.
 *
 * getPosition: () => seconds into the song, as you hear it.
 */
const LyricsView = ({
  songId,
  nextSongId,
  getPosition,
  active,
  onSeek,
  size = 'large',
  className,
}) => {
  const { data, isPending, isError, refetch } = useLyrics(songId, active);
  const prefetch = usePrefetchLyrics();
  const lines = data?.kind === 'synced' ? data.lines : null;
  const [current, setCurrent] = useState(-1);
  const [linesFor, setLinesFor] = useState(songId);
  const scrollRef = useRef(null);
  const lineRefs = useRef([]);
  const holdUntil = useRef(0);

  // A new song starts at the top, with no line lit.
  if (linesFor !== songId) {
    setLinesFor(songId);
    setCurrent(-1);
  }

  useEffect(() => {
    lineRefs.current = [];
    holdUntil.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [songId]);

  useEffect(() => {
    if (active) prefetch(nextSongId);
  }, [active, nextSongId, prefetch]);

  useEffect(() => {
    if (!active || !lines) return;
    const read = () => setCurrent(lineAt(lines, getPosition() * 1000 + LEAD_MS));
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [active, getPosition, lines]);

  const follow = useCallback((index, smooth) => {
    const view = scrollRef.current;
    const line = lineRefs.current[Math.max(0, index)];
    if (!view || !line || Date.now() < holdUntil.current) return;
    const top = line.offsetTop - view.clientHeight * FOCUS_AT;
    view.scrollTo({
      top: Math.max(0, top),
      behavior: smooth && !reducedMotion() ? 'smooth' : 'auto',
    });
  }, []);

  // Opened mid-song, it jumps there; after that it glides from line to line.
  const followed = useRef(false);
  useEffect(() => {
    if (!active || !lines) {
      followed.current = false;
      return;
    }
    follow(current, followed.current);
    followed.current = true;
  }, [active, current, follow, lines]);

  const hold = () => {
    holdUntil.current = Date.now() + HOLD_AFTER_SCROLL_MS;
  };

  if (!songId) return null;
  if (isPending) return <Placeholder size={size} />;
  if (isError || !data || data.kind === 'none') {
    return <Empty failed={isError} onRetry={() => void refetch()} />;
  }

  const lineClass =
    size === 'large' ? 'text-2xl sm:text-[1.7rem] leading-snug' : 'text-lg leading-snug';

  return (
    <div
      ref={scrollRef}
      onWheel={hold}
      onTouchMove={hold}
      className={cn(
        'relative h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        '[mask-image:linear-gradient(to_bottom,transparent,black_6%,black_88%,transparent)]',
        className
      )}
    >
      <div className='px-1 pt-6 pb-24'>
        {lines ? (
          <ol className='space-y-1'>
            {lines.map((line, index) => {
              const state = index === current ? 'current' : index < current ? 'past' : 'next';
              const text = line.text || '♪';
              return (
                <li key={`${line.t}-${index}`} ref={(el) => (lineRefs.current[index] = el)}>
                  <button
                    type='button'
                    disabled={!onSeek}
                    onClick={() => {
                      holdUntil.current = 0;
                      onSeek?.(line.t / 1000);
                    }}
                    aria-current={state === 'current' ? 'true' : undefined}
                    className={cn(
                      'block w-full rounded-lg py-1.5 text-left font-bold tracking-tight transition-[color,opacity] duration-300',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      onSeek ? 'cursor-pointer hover:opacity-100' : 'cursor-default',
                      lineClass,
                      state === 'current'
                        ? 'text-foreground'
                        : state === 'past'
                          ? 'text-foreground/40'
                          : 'text-foreground/30'
                    )}
                  >
                    {text}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p
            className={cn(
              'whitespace-pre-line font-semibold text-foreground',
              size === 'large' ? 'text-lg leading-8' : 'text-[15px] leading-7'
            )}
          >
            {data.text}
          </p>
        )}
        <Footer lyrics={data} songId={songId} />
      </div>
    </div>
  );
};

export default memo(LyricsView);
