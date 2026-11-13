import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import { memo } from 'react';
import { replyLabel } from '@/lib/attachments';
import { cn } from '@/lib/utils';
import AttachmentView from './AttachmentView';
import { formatTime } from './ChatDateUtils';
import MessageActions from './MessageActions';

const STATUS_LABEL = { sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read' };

const StatusIcon = ({ status }) => {
  if (status === 'sending') return <Clock className='h-3 w-3 animate-pulse' />;
  if (status === 'sent') return <Check size={14} className='text-muted-foreground/70' />;
  if (status === 'delivered') return <CheckCheck size={15} className='text-muted-foreground' />;
  if (status === 'read') return <CheckCheck size={15} strokeWidth={2.4} className='text-receipt' />;
  return null;
};

/** The message this one answers, quoted above it. Clicking goes to the original. */
const ReplyQuote = ({ replyTo, isOwn, authorName, onJump }) => (
  <button
    type='button'
    onClick={() => onJump(replyTo.id)}
    className={cn(
      'mb-1.5 flex w-full min-w-0 cursor-pointer flex-col items-start rounded-md border-l-2 px-2 py-1 text-left',
      isOwn
        ? 'border-primary-foreground/60 bg-primary-foreground/15'
        : 'border-foreground/40 bg-foreground/[0.06]'
    )}
  >
    <span className='text-[11px] font-semibold opacity-90'>{authorName}</span>
    <span className={cn('line-clamp-2 text-xs opacity-80', replyTo.deleted && 'italic')}>
      {replyTo.deleted ? 'Deleted message' : replyLabel(replyTo)}
    </span>
  </button>
);

const Reactions = ({ reactions, meId, isOwn, onToggle }) => {
  if (!reactions.length) return null;
  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', isOwn && 'justify-end')}>
      {reactions.map(({ emoji, userIds }) => {
        const mine = userIds.includes(meId);
        return (
          <button
            key={emoji}
            type='button'
            onClick={() => onToggle(emoji)}
            aria-pressed={mine}
            aria-label={`${emoji} ${userIds.length}${mine ? ', including you' : ''}`}
            className={cn(
              'flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs transition-colors',
              mine
                ? 'border-primary/40 bg-primary/15 text-foreground'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:border-border'
            )}
          >
            <span className='text-[13px] leading-none'>{emoji}</span>
            {userIds.length > 1 && (
              <span className='font-medium tabular-nums'>{userIds.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

const MessageBubble = ({
  message,
  isOwn,
  meId,
  peerName,
  status,
  startsRun,
  endsRun,
  menuOpen,
  selected,
  onSelect,
  onMenuOpenChange,
  actions,
  onJump,
}) => {
  const pending = message.id == null;
  const failed = status === 'failed';
  const attachment = message.attachment;
  const visual = attachment && ['image', 'video'].includes(attachment.kind ?? 'image');
  const mediaOnly = visual && !message.body && !message.replyTo;

  return (
    <div
      id={pending ? undefined : `message-${message.id}`}
      className={cn(
        'group/message flex rounded-lg transition-colors duration-500',
        isOwn ? 'justify-end' : 'justify-start',
        startsRun ? 'mt-2.5' : 'mt-0.5'
      )}
    >
      <div
        className={cn(
          'flex max-w-[78%] flex-col md:max-w-[62%]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        <div className={cn('relative flex items-center gap-1', isOwn && 'flex-row-reverse')}>
          <div
            onPointerUp={(e) => e.pointerType === 'touch' && onSelect()}
            className={cn(
              'min-w-0 overflow-hidden rounded-2xl',
              !mediaOnly && 'px-3 py-2',
              !mediaOnly &&
                (isOwn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground dark:bg-muted/70'),
              isOwn ? !endsRun && 'rounded-br-md' : !endsRun && 'rounded-bl-md',
              isOwn ? !startsRun && 'rounded-tr-md' : !startsRun && 'rounded-tl-md',
              failed && 'opacity-70'
            )}
          >
            {message.replyTo && (
              <ReplyQuote
                replyTo={message.replyTo}
                isOwn={isOwn}
                authorName={message.replyTo.senderId === meId ? 'You' : peerName}
                onJump={onJump}
              />
            )}

            {attachment && (
              <div className={cn(!mediaOnly && message.body && 'mb-2')}>
                <AttachmentView
                  message={message}
                  isOwn={isOwn}
                  sending={status === 'sending'}
                  mediaRounded={mediaOnly ? '' : 'rounded-xl'}
                  actions={actions}
                />
              </div>
            )}

            {message.body && (
              <div className='whitespace-pre-wrap text-sm wrap-anywhere'>{message.body}</div>
            )}
          </div>

          {!pending && (
            <MessageActions
              message={message}
              isOwn={isOwn}
              meId={meId}
              open={menuOpen}
              shown={selected}
              onOpenChange={onMenuOpenChange}
              actions={actions}
            />
          )}
        </div>

        <Reactions
          reactions={message.reactions}
          meId={meId}
          isOwn={isOwn}
          onToggle={(emoji) => actions.react(message, emoji)}
        />

        {failed ? (
          <div className='mt-1 flex items-center gap-2 px-1 text-xs text-destructive'>
            <AlertCircle className='h-3.5 w-3.5' />
            <span>{message.error || 'Not sent'}</span>
            <button
              type='button'
              onClick={() => actions.retry(message)}
              className='cursor-pointer font-semibold underline'
            >
              Retry
            </button>
            <button
              type='button'
              onClick={() => actions.discard(message)}
              className='cursor-pointer text-muted-foreground underline'
            >
              Delete
            </button>
          </div>
        ) : (
          (endsRun || message.editedAt || pending) && (
            <div className='mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground'>
              {message.editedAt && <span>Edited ·</span>}
              <span className='tabular-nums'>{formatTime(message.createdAt)}</span>
              {isOwn && status && (
                <span
                  title={STATUS_LABEL[status]}
                  aria-label={STATUS_LABEL[status]}
                  className='flex items-center'
                >
                  <StatusIcon status={status} />
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default memo(MessageBubble);
