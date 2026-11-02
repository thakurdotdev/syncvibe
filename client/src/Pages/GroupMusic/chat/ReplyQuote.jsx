import { cn } from '@/lib/utils';
import { CornerUpLeft, X } from 'lucide-react';
import { memo } from 'react';

/** Quoted message shown inside a reply bubble; click jumps to the original. */
export const ReplyQuote = memo(({ replyTo, isOwn, onJump }) => (
  <button
    type='button'
    onClick={() => onJump?.(replyTo.id)}
    className={cn(
      'mb-1 flex w-full min-w-0 cursor-pointer flex-col items-start rounded-lg border-l-2 px-2 py-1 text-left transition-colors',
      isOwn
        ? 'border-primary/60 bg-background/40 hover:bg-background/60'
        : 'border-foreground/30 bg-foreground/[0.05] hover:bg-foreground/[0.08]'
    )}
    title='Jump to message'
  >
    <span className='text-[11px] font-semibold text-foreground/80'>
      {replyTo.userName || 'Someone'}
    </span>
    <span className='line-clamp-2 text-[12px] text-muted-foreground'>
      {replyTo.message || 'Message'}
    </span>
  </button>
));

/** "Replying to …" bar above the composer. */
export const ReplyingToBar = memo(({ target, preview, onCancel }) => (
  <div className='mb-1.5 flex items-center gap-2 rounded-xl bg-foreground/[0.05] py-1.5 pl-3 pr-1.5'>
    <CornerUpLeft className='h-3.5 w-3.5 shrink-0 text-primary' aria-hidden='true' />
    <div className='min-w-0 flex-1 text-xs'>
      <span className='text-muted-foreground'>Replying to </span>
      <span className='font-semibold'>{target.userName || 'Someone'}</span>
      <p className='truncate text-muted-foreground'>{preview}</p>
    </div>
    <button
      type='button'
      onClick={onCancel}
      aria-label='Cancel reply'
      title='Cancel reply (Esc)'
      className='flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
    >
      <X className='h-3.5 w-3.5' />
    </button>
  </div>
));
