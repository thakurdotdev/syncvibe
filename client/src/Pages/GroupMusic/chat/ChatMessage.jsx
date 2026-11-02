import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { getInitial } from '../utils/song';
import {
  formatMessageTime,
  isEmojiOnly,
  isGifMessage,
  isSoundMessage,
  mentionsUser,
} from './chatUtils';
import MediaMessage from './MediaMessage';
import MessageActions from './MessageActions';
import MessageReactions from './MessageReactions';
import { ReplyQuote } from './ReplyQuote';
import SoundMessage from './SoundMessage';

const ENTER_ANIMATION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};

const QUICK_REACTION = '❤️';

// Clicks on controls inside the bubble (sound player, reply quote, media toggle)
// or finishing a text selection shouldn't toggle the action bar.
const isPassiveClick = (event) =>
  !event.target.closest('button, a, video') && !window.getSelection()?.toString();

const bubbleShape = (isOwn, startsGroup, endsGroup) =>
  cn(
    'rounded-2xl',
    isOwn ? !startsGroup && 'rounded-tr-md' : !startsGroup && 'rounded-tl-md',
    isOwn ? !endsGroup && 'rounded-br-md' : !endsGroup && 'rounded-bl-md'
  );

const MessageContent = ({ msg, isOwn, mediaBlur }) => {
  if (isSoundMessage(msg)) return <SoundMessage msg={msg} isOwn={isOwn} />;
  if (isGifMessage(msg)) return <MediaMessage url={msg.gifUrl} globalBlur={mediaBlur} />;
  if (isEmojiOnly(msg.message)) {
    return <p className='select-none text-4xl leading-tight'>{msg.message}</p>;
  }
  return (
    <p className='whitespace-pre-wrap break-words text-[13.5px] leading-relaxed'>{msg.message}</p>
  );
};

/**
 * A chat message. Interactions:
 *  - hover / focus (desktop) or tap (touch) → quick reactions + reply
 *  - double-click → ❤️
 *  - click a reply quote → jump to the original message
 */
const ChatMessage = ({
  msg,
  isOwn,
  startsGroup,
  endsGroup,
  animate,
  mediaBlur,
  currentUserId,
  currentUserName,
  isActive,
  isHighlighted,
  onActivate,
  onReact,
  onReply,
  onJumpTo,
}) => {
  const time = formatMessageTime(msg.timestamp);
  const bare = isGifMessage(msg) || isEmojiOnly(msg.message);
  const mentionsMe = !isOwn && mentionsUser(msg.message, currentUserName);
  const canInteract = Boolean(msg.id);

  const react = (emoji) => onReact(msg.id, emoji);

  return (
    <motion.div
      {...(animate ? ENTER_ANIMATION : {})}
      data-message-id={msg.id}
      className={cn(
        'group/message relative flex gap-2.5 rounded-lg px-3 transition-colors duration-700',
        isOwn && 'flex-row-reverse',
        startsGroup ? 'mt-3' : 'mt-0.5',
        isHighlighted && 'bg-primary/10 duration-150',
        mentionsMe && 'bg-amber-500/[0.06]'
      )}
    >
      {canInteract && (
        <MessageActions
          isOwn={isOwn}
          visible={isActive}
          onReact={react}
          onReply={() => onReply(msg)}
        />
      )}

      {!isOwn && (
        <div className='w-8 shrink-0'>
          {startsGroup && (
            <Avatar className='h-8 w-8'>
              <AvatarImage src={msg.profilePic} />
              <AvatarFallback className='bg-accent text-xs font-medium'>
                {getInitial(msg.userName)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn('flex min-w-0 max-w-[80%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {startsGroup && (
          <div className={cn('mb-1 flex items-baseline gap-2 px-1', isOwn && 'flex-row-reverse')}>
            {!isOwn && (
              <span className='truncate text-xs font-semibold text-foreground/90'>
                {msg.userName}
              </span>
            )}
            <time className='shrink-0 text-[10px] text-muted-foreground/60'>{time}</time>
          </div>
        )}

        <div
          role={canInteract ? 'button' : undefined}
          tabIndex={canInteract ? 0 : undefined}
          aria-label={
            canInteract ? `Message from ${msg.userName || 'you'}. Show actions` : undefined
          }
          title={startsGroup ? undefined : time}
          onClick={canInteract ? (e) => isPassiveClick(e) && onActivate(msg.id) : undefined}
          onDoubleClick={
            canInteract
              ? (e) => {
                  if (e.target.closest('button, a, video')) return;
                  window.getSelection()?.removeAllRanges();
                  react(QUICK_REACTION);
                }
              : undefined
          }
          onKeyDown={
            canInteract
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onActivate(msg.id);
                  }
                }
              : undefined
          }
          className={cn(
            'min-w-0 select-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            !bare && 'px-3 py-1.5',
            !bare && (isOwn ? 'liquid-message-own' : 'liquid-message-other'),
            !bare && bubbleShape(isOwn, startsGroup, endsGroup),
            bare && 'rounded-xl'
          )}
        >
          {msg.replyTo?.id && <ReplyQuote replyTo={msg.replyTo} isOwn={isOwn} onJump={onJumpTo} />}
          <MessageContent msg={msg} isOwn={isOwn} mediaBlur={mediaBlur} />
        </div>

        <MessageReactions
          reactions={msg.reactions}
          currentUserId={currentUserId}
          onToggle={react}
          align={isOwn ? 'end' : 'start'}
        />
      </div>
    </motion.div>
  );
};

export default memo(ChatMessage);
