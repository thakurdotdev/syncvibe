/* oxlint-disable jsx-a11y/no-static-element-interactions -- the floating tile is dragged with the pointer and is a button when it can be tapped */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** A camera picture. Always silent: the other person's voice plays once, in CallLayer. */
export const CallVideo = ({ stream, mirrored = false, adaptive = false, className }) => {
  const ref = useRef(null);
  const [fit, setFit] = useState('cover');

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    video.srcObject = stream ?? null;
    if (stream) video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // A phone held upright sending to a wide window (or the other way round) would lose most of
  // the picture if it were cropped to fill, so then it is shown whole.
  useEffect(() => {
    const video = ref.current;
    if (!adaptive || !video) return undefined;
    const update = () => {
      if (!video.videoWidth || !video.clientWidth) return;
      const pictureIsWide = video.videoWidth >= video.videoHeight;
      const frameIsWide = video.clientWidth >= video.clientHeight;
      setFit(pictureIsWide === frameIsWide ? 'cover' : 'contain');
    };
    video.addEventListener('resize', update);
    video.addEventListener('loadedmetadata', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      video.removeEventListener('resize', update);
      video.removeEventListener('loadedmetadata', update);
      window.removeEventListener('resize', update);
    };
  }, [adaptive]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      disablePictureInPicture
      className={cn(
        'pointer-events-none bg-scrim',
        fit === 'contain' ? 'object-contain' : 'object-cover',
        mirrored && '-scale-x-100',
        className
      )}
    />
  );
};

export const CallAvatar = ({ person, className, textClassName }) => (
  <Avatar className={cn('border border-on-scrim/15', className)}>
    <AvatarImage alt='' src={getProfileCloudinaryUrl(person?.profilepic)} />
    <AvatarFallback className={cn('bg-on-scrim/10 font-medium text-on-scrim', textClassName)}>
      {person?.name?.[0]?.toUpperCase() || '?'}
    </AvatarFallback>
  </Avatar>
);

const pad = (n) => String(n).padStart(2, '0');

export const CallTimer = ({ since }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return (
    <span className='tabular-nums'>
      {hours > 0 ? `${hours}:${pad(minutes)}` : pad(minutes)}:{pad(seconds % 60)}
    </span>
  );
};

/** How far the pointer may move and still count as a tap. */
const TAP_SLOP = 6;

/**
 * A tile that floats over the page, can be dragged anywhere and settles in the nearest corner.
 * `inset` is the space to keep from each edge of the window, in px.
 */
export const FloatingTile = ({
  startCorner = 'top-right',
  inset,
  onTap,
  label,
  className,
  children,
}) => {
  const ref = useRef(null);
  const gesture = useRef(null);
  const [corner, setCorner] = useState(startCorner);
  const [offset, setOffset] = useState(null);

  const [vertical, horizontal] = corner.split('-');

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-no-drag]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event) => {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    start.moved = true;
    setOffset({ x: dx, y: dy });
  };

  const onPointerUp = () => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    if (!start.moved) {
      onTap?.();
      return;
    }

    const tile = ref.current;
    const from = tile.getBoundingClientRect();
    const next = `${from.top + from.height / 2 < window.innerHeight / 2 ? 'top' : 'bottom'}-${
      from.left + from.width / 2 < window.innerWidth / 2 ? 'left' : 'right'
    }`;
    // Placed in its corner first, then animated there from where it was let go.
    flushSync(() => {
      setCorner(next);
      setOffset(null);
    });
    const to = tile.getBoundingClientRect();
    tile.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
  };

  return (
    <div
      ref={ref}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={label}
      onKeyDown={(event) => {
        if (onTap && event.target === event.currentTarget && event.key === 'Enter') onTap();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => event.stopPropagation()}
      style={{
        [vertical]: inset[vertical],
        [horizontal]: inset[horizontal],
        transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
      }}
      className={cn(
        'fixed touch-none select-none overflow-hidden rounded-2xl bg-scrim shadow-[0_12px_40px_-12px_hsl(var(--scrim)/0.7)] ring-1 ring-on-scrim/15',
        offset ? 'cursor-grabbing' : 'cursor-grab',
        className
      )}
    >
      {children}
    </div>
  );
};
