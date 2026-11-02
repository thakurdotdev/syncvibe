import { cn } from '@/lib/utils';

/** Animated "now playing" bars. */
const Equalizer = ({ bars = 4, className, barClassName }) => (
  <span className={cn('flex items-end gap-[3px]', className)} aria-hidden='true'>
    {Array.from({ length: bars }, (_, i) => (
      <span
        key={i}
        className={cn('h-full w-[3px] origin-bottom rounded-full animate-wave', barClassName)}
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </span>
);

export default Equalizer;
