import { cn } from '@/lib/utils';
import { CornerUpLeft } from 'lucide-react';
import { memo } from 'react';
import { MESSAGE_REACTIONS } from './chatUtils';

/**
 * Hover (desktop) / tap (touch) toolbar for a message: quick reactions + reply.
 * Visibility is controlled by the parent via `visible` and the `group/message` hover.
 */
const MessageActions = ({ isOwn, visible, onReact, onReply }) => (
  <div
    role='toolbar'
    aria-label='Message actions'
    className={cn(
      'absolute -top-4 z-10 flex items-center gap-0.5 rounded-full border border-border/50 bg-popover p-0.5 shadow-lg transition-opacity duration-100',
      isOwn ? 'right-2' : 'left-12',
      visible
        ? 'pointer-events-auto opacity-100'
        : 'pointer-events-none opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100'
    )}
  >
    {MESSAGE_REACTIONS.map((emoji) => (
      <button
        key={emoji}
        type='button'
        onClick={() => onReact(emoji)}
        aria-label={`React ${emoji}`}
        className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[15px] transition-transform hover:scale-125 hover:bg-foreground/5'
      >
        {emoji}
      </button>
    ))}
    <span className='mx-0.5 h-4 w-px bg-border/60' aria-hidden='true' />
    <button
      type='button'
      onClick={onReply}
      aria-label='Reply'
      title='Reply'
      className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
    >
      <CornerUpLeft className='h-3.5 w-3.5' />
    </button>
  </div>
);

export default memo(MessageActions);
