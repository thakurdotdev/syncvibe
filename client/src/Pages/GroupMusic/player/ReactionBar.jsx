import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { memo, useCallback, useRef } from 'react';

export const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'];
const COOLDOWN_MS = 500;

const ReactionBar = ({ onReact, className, buttonClassName }) => {
  const lastSentAt = useRef({});

  const handleReact = useCallback(
    (emoji) => {
      const now = Date.now();
      if (now - (lastSentAt.current[emoji] || 0) < COOLDOWN_MS) return;
      lastSentAt.current[emoji] = now;
      onReact?.(emoji);
    },
    [onReact]
  );

  return (
    <div className={cn('flex items-center', className)} role='group' aria-label='Send a reaction'>
      {REACTIONS.map((emoji) => (
        <motion.button
          key={emoji}
          type='button'
          aria-label={`React ${emoji}`}
          onClick={() => handleReact(emoji)}
          whileTap={{ scale: 1.25, transition: { duration: 0.1 } }}
          className={cn(
            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-base transition-colors hover:bg-foreground/5',
            buttonClassName
          )}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
};

/** Space-saving variant: one button that opens the reaction bar. */
export const ReactionPopover = memo(({ onReact, className }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type='button'
        aria-label='Send a reaction'
        className={cn(
          'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
          className
        )}
      >
        <SmilePlus className='h-4 w-4' />
      </button>
    </PopoverTrigger>
    <PopoverContent side='top' className='w-auto rounded-full p-1'>
      <ReactionBar onReact={onReact} />
    </PopoverContent>
  </Popover>
));

export default memo(ReactionBar);
