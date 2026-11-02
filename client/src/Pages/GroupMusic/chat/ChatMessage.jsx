import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { getInitial } from '../utils/song';
import { formatMessageTime, isEmojiOnly, isGifMessage, isSoundMessage } from './chatUtils';
import MediaMessage from './MediaMessage';
import SoundMessage from './SoundMessage';

const ENTER_ANIMATION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};

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

const ChatMessage = ({ msg, isOwn, startsGroup, endsGroup, animate, mediaBlur }) => {
  const time = formatMessageTime(msg.timestamp);
  const bare = isGifMessage(msg) || isEmojiOnly(msg.message);

  return (
    <motion.div
      {...(animate ? ENTER_ANIMATION : {})}
      className={cn(
        'flex gap-2.5 px-3',
        isOwn && 'flex-row-reverse',
        startsGroup ? 'mt-3' : 'mt-0.5'
      )}
    >
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
          title={startsGroup ? undefined : time}
          className={cn(
            !bare && 'px-3 py-1.5',
            !bare && (isOwn ? 'liquid-message-own' : 'liquid-message-other'),
            !bare && bubbleShape(isOwn, startsGroup, endsGroup)
          )}
        >
          <MessageContent msg={msg} isOwn={isOwn} mediaBlur={mediaBlur} />
        </div>
      </div>
    </motion.div>
  );
};

export default memo(ChatMessage);
