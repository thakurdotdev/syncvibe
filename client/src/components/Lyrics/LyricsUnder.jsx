import { memo, useEffect, useState } from 'react';
import { useLyrics, usePrefetchLyrics } from '@/hooks/useLyrics';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import LyricsGlance, { glanceHeight, PlainLyricsLink } from './LyricsGlance';
import LyricsSheet from './LyricsSheet';

/** A song's lyrics when there are some to show under its cover (and they're switched on). */
export const useShownLyrics = (songId) => {
  const showLyrics = useUiStore((s) => s.showLyrics);
  const { data } = useLyrics(songId, showLyrics);
  return showLyrics && (data?.kind === 'synced' || data?.kind === 'plain') ? data : null;
};

/**
 * The lines under a cover (or a room's player), opening out when the song has lyrics and folding
 * away when it doesn't; clicking them opens the whole song. getPosition: () => seconds, as heard.
 */
const LyricsUnder = ({
  songId,
  nextSongId,
  songName,
  getPosition,
  onSeek,
  active,
  size = 'player',
  center = false,
  className,
}) => {
  const lyrics = useShownLyrics(songId);
  const prefetch = usePrefetchLyrics();
  const [open, setOpen] = useState(false);
  const showLyrics = useUiStore((s) => s.showLyrics);

  useEffect(() => {
    if (active && showLyrics) prefetch(nextSongId);
  }, [active, nextSongId, prefetch, showLyrics]);

  return (
    <>
      {/* Opens and folds with a grid-rows transition (not a height animation). */}
      <div
        className={cn(
          'grid w-full transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none',
          lyrics ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!lyrics}
      >
        <div className='min-h-0 overflow-hidden'>
          <div className={className} style={{ minHeight: glanceHeight(size) }}>
            {lyrics?.kind === 'synced' ? (
              <LyricsGlance
                lines={lyrics.lines}
                getPosition={getPosition}
                active={active}
                size={size}
                center={center}
                onOpen={() => setOpen(true)}
              />
            ) : lyrics?.kind === 'plain' ? (
              <PlainLyricsLink lyrics={lyrics} center={center} onOpen={() => setOpen(true)} />
            ) : null}
          </div>
        </div>
      </div>
      <LyricsSheet
        open={open}
        onOpenChange={setOpen}
        songId={songId}
        nextSongId={nextSongId}
        songName={songName}
        getPosition={getPosition}
        onSeek={onSeek}
      />
    </>
  );
};

export default memo(LyricsUnder);
