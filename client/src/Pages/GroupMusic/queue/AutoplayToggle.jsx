import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { memo } from 'react';

const AutoplayToggle = ({ enabled, onToggle, className }) => (
  <button
    type='button'
    role='switch'
    aria-checked={enabled}
    onClick={() => onToggle()}
    aria-label='Autoplay'
    title={enabled ? 'Autoplay on: similar songs play when the queue ends' : 'Autoplay off'}
    className={cn(
      'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
      enabled
        ? 'bg-primary/15 text-primary ring-1 ring-primary/25'
        : 'bg-foreground/[0.04] text-muted-foreground hover:text-foreground',
      className
    )}
  >
    <Sparkles className='h-3.5 w-3.5' />
    <span className='hidden sm:inline'>Autoplay</span>
  </button>
);

export default memo(AutoplayToggle);
