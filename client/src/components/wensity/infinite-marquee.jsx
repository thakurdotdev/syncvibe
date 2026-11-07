import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * InfiniteMarquee
 *
 * Zero-jitter, GPU-only horizontal marquee. We duplicate the children once
 * and animate from `translate3d(0,0,0)` → `translate3d(-50%,0,0)` via a CSS
 * keyframe (defined in `globals.css`), so the work stays on the compositor
 * and never touches the JS thread.
 */
export function InfiniteMarquee({
  items,
  speed = 30,
  direction = 'left',
  pauseOnHover = false,
  gap = 'gap-20',
  fade = true,
  className,
}) {
  return (
    <div
      className={cn(
        'group/marquee relative w-full overflow-hidden',
        fade && [
          '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
          '[-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
        ],
        className
      )}
    >
      <div
        className={cn(
          'flex w-max items-center will-change-transform',
          // Honour the OS reduced-motion preference — freeze the loop.
          'motion-reduce:![animation:none]',
          gap
        )}
        style={{
          animation: `${
            direction === 'left' ? 'wensity-marquee-x' : 'wensity-marquee-x-reverse'
          } ${speed}s linear infinite`,
          animationPlayState: 'running',
        }}
        onMouseEnter={(e) => {
          if (pauseOnHover) e.currentTarget.style.animationPlayState = 'paused';
        }}
        onMouseLeave={(e) => {
          if (pauseOnHover) e.currentTarget.style.animationPlayState = 'running';
        }}
      >
        {/* Original strip */}
        <div className={cn('flex shrink-0 items-center', gap)} aria-hidden={false}>
          {items.map((node, i) => (
            <div key={`a-${i}`} className='shrink-0'>
              {node}
            </div>
          ))}
        </div>
        {/* Duplicate — exactly once — for the seamless wrap at -50%. */}
        <div className={cn('flex shrink-0 items-center', gap)} aria-hidden>
          {items.map((node, i) => (
            <div key={`b-${i}`} className='shrink-0'>
              {node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
