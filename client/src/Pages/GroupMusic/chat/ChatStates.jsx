import { Lock, MessageCircle, Sparkles } from 'lucide-react';
import { memo } from 'react';

export const ChatEmptyState = memo(() => (
  <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
    <div className='rounded-2xl bg-foreground/[0.04] p-3.5'>
      <MessageCircle className='h-5 w-5 text-muted-foreground/60' />
    </div>
    <div className='space-y-1'>
      <p className='text-sm font-medium'>No messages yet</p>
      <p className='text-xs text-muted-foreground'>Say hi, share a GIF or drop a sound effect.</p>
    </div>
  </div>
));

export const ChatLockedOverlay = memo(({ onUpgrade }) => (
  <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-6 backdrop-blur-md'>
    <div className='flex max-w-xs flex-col items-center gap-3.5 text-center'>
      <div className='rounded-2xl bg-foreground/[0.06] p-3.5'>
        <Lock className='h-5 w-5 text-muted-foreground' />
      </div>
      <div className='space-y-1'>
        <p className='text-sm font-semibold'>Group chat is a PRO feature</p>
        <p className='text-xs text-muted-foreground'>
          Upgrade to chat, share GIFs and play sound effects with your group.
        </p>
      </div>
      <button
        type='button'
        onClick={onUpgrade}
        className='flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95'
      >
        <Sparkles className='h-3.5 w-3.5' />
        Upgrade to PRO
      </button>
    </div>
  </div>
));

const TypingDot = ({ delay }) => (
  <span
    className='h-[5px] w-[5px] rounded-full bg-muted-foreground/60'
    style={{ animation: `typing-dot 1s ease-in-out ${delay}s infinite` }}
  />
);

const describeTyping = (names) => {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
};

/** Fixed-height line so the composer never jumps when someone starts typing. */
export const TypingIndicator = memo(({ names }) => (
  <div
    className='flex h-5 shrink-0 items-center gap-2 px-4 text-[11px] text-muted-foreground'
    aria-live='polite'
  >
    {names.length > 0 && (
      <>
        <span className='flex items-center gap-[3px]' aria-hidden='true'>
          <TypingDot delay={0} />
          <TypingDot delay={0.15} />
          <TypingDot delay={0.3} />
        </span>
        <span className='truncate'>{describeTyping(names)}</span>
      </>
    )}
  </div>
));
