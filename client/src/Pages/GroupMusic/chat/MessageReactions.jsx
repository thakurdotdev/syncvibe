import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo } from 'react';
import { summarizeReactions } from './chatUtils';

const describe = ({ emoji, names, count }) => {
  if (!names.length) return `${count} reacted with ${emoji}`;
  const shown = names.slice(0, 3).join(', ');
  const rest = count - Math.min(names.length, 3);
  return `${shown}${rest > 0 ? ` and ${rest} more` : ''} reacted with ${emoji}`;
};

/** Reaction chips under a message; clicking one toggles your own reaction. */
const MessageReactions = ({ reactions, currentUserId, onToggle, align }) => {
  const chips = useMemo(
    () => summarizeReactions(reactions, currentUserId),
    [reactions, currentUserId]
  );
  if (!chips.length) return null;

  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', align === 'end' && 'justify-end')}>
      <AnimatePresence initial={false}>
        {chips.map((chip) => (
          <motion.button
            key={chip.emoji}
            type='button'
            layout
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => onToggle(chip.emoji)}
            title={describe(chip)}
            aria-label={describe(chip)}
            aria-pressed={chip.reactedByMe}
            className={cn(
              'flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs transition-colors',
              chip.reactedByMe
                ? 'border-primary/40 bg-primary/15 text-foreground'
                : 'border-border/40 bg-background/60 text-muted-foreground hover:border-border'
            )}
          >
            <span className='text-[13px] leading-none'>{chip.emoji}</span>
            <span className='font-medium tabular-nums'>{chip.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default memo(MessageReactions);
