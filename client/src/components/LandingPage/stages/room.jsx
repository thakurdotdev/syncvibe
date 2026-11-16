import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button, Swap, clock } from '@/components/stageshow';
import { DEMO_PLAYLIST } from '../demoSong';

// Pieces of a SyncVibe room shared by the landing page's stages. A stage's state says which song
// the room is on (`i`, counting up forever, so a loop never rewinds) and where its playhead was
// at a moment of stage time (`at` seconds at `since`). Every screen reads the same state, which
// is the point of the demo: the laptop and the phone can't disagree.

export const songAt = (i) => DEMO_PLAYLIST[i % DEMO_PLAYLIST.length];

const formatTime = (seconds) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const positionOf = (s) => {
  const elapsed = s.since == null || !s.playing ? 0 : (clock.now() - s.since) / 1000;
  return Math.min(s.at + elapsed, songAt(s.i).duration);
};

export const Cover = ({ i, size, radius, className = '' }) => (
  <span
    className={`sv-cover ${className}`}
    style={{ width: size, height: size, borderRadius: radius }}
  >
    {DEMO_PLAYLIST.map((song, n) => (
      <img
        key={song.id}
        src={song.cover}
        alt=''
        width={size}
        height={size}
        draggable={false}
        data-on={n === i % DEMO_PLAYLIST.length || undefined}
      />
    ))}
  </span>
);

export const SongTitle = ({ i, className }) => (
  <span className={className}>
    <Swap id={songAt(i).id}>{songAt(i).name}</Swap>
  </span>
);

export const SongArtist = ({ i, className }) => (
  <span className={className}>
    <Swap id={songAt(i).id}>{songAt(i).artists}</Swap>
  </span>
);

/** The track and the two times, driven by the stage clock rather than React renders. */
export const Playhead = ({ s }) => {
  const track = useRef(null);
  const time = useRef(null);
  const { duration } = songAt(s.i);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const position = positionOf(s);
      track.current?.style.setProperty('--sv-p', `${(position / duration) * 100}%`);
      if (time.current) time.current.textContent = formatTime(position);
      if (s.playing && s.since != null) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [s, duration]);

  return (
    <div className='sv-playhead'>
      <div ref={track} className='sv-track' style={{ '--sv-p': `${(s.at / duration) * 100}%` }} />
      <div className='sv-times'>
        <span ref={time}>{formatTime(s.at)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export const Transport = ({ s, size = 32, target }) => (
  <div className='sv-transport' style={{ '--sv-round': `${size}px` }}>
    <Button
      variant='ghost'
      className='sv-round'
      icon={<SkipBack size={16} fill='currentColor' />}
    />
    <Button
      variant='primary'
      className='sv-round sv-round--play'
      style={{ '--sv-round': `${size + 6}px` }}
      icon={
        s.playing ? <Pause size={16} fill='currentColor' /> : <Play size={16} fill='currentColor' />
      }
    />
    <Button
      variant='ghost'
      className='sv-round'
      data-target={target}
      icon={<SkipForward size={16} fill='currentColor' />}
    />
  </div>
);

/** One reaction, rising from where it was sent. Re-keyed per send, so each one plays once. */
export const Burst = ({ n, style }) =>
  n > 0 ? (
    <span key={n} className='sv-burst' style={style} aria-hidden='true'>
      🔥
    </span>
  ) : null;
