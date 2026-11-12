import { cn } from '@/lib/utils';

/**
 * Online dot for an avatar. Put it next to the `Avatar`, inside a `relative` wrapper: the avatar
 * clips its children to a circle, which would cut the dot off. The ring should match the surface
 * behind the avatar so the dot reads as cut out of it.
 */
const PresenceDot = ({ online, className }) =>
  online ? (
    <span
      title='Online'
      className={cn(
        'pointer-events-none absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-success ring-2 ring-background',
        className
      )}
    >
      <span className='sr-only'>Online</span>
    </span>
  ) : null;

export default PresenceDot;
