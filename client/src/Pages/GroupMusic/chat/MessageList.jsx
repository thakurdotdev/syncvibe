import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import ActivityDivider from './ActivityDivider';
import ChatMessage from './ChatMessage';
import { ChatEmptyState } from './ChatStates';
import { buildChatItems } from './chatUtils';
import { useStickToBottom } from './useStickToBottom';

const JumpToLatest = ({ unseenCount, onClick }) => (
  <motion.button
    type='button'
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    transition={{ duration: 0.15 }}
    onClick={onClick}
    className='absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background shadow-lg'
  >
    <ArrowDown className='h-3.5 w-3.5' />
    {unseenCount > 0
      ? `${unseenCount} new message${unseenCount === 1 ? '' : 's'}`
      : 'Jump to latest'}
  </motion.button>
);

const MessageList = ({ messages, currentUserId, mediaBlur }) => {
  const items = useMemo(() => buildChatItems(messages, currentUserId), [messages, currentUserId]);
  // Only messages that arrive after mount animate in; history renders instantly.
  const [animateFromIndex] = useState(items.length);
  const lastItem = items[items.length - 1];

  const { scrollRef, contentRef, isAtBottom, unseenCount, handleScroll, scrollToBottom } =
    useStickToBottom({ itemCount: items.length, lastItemIsOwn: Boolean(lastItem?.isOwn) });

  return (
    <div className='relative min-h-0 flex-1'>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className='h-full overflow-y-auto overscroll-contain chat-scroll-area'
        role='log'
        aria-live='polite'
        aria-label='Chat messages'
      >
        <div ref={contentRef} className='flex min-h-full flex-col justify-end pb-2 pt-1'>
          {items.length === 0 ? (
            <ChatEmptyState />
          ) : (
            items.map((item, index) =>
              item.kind === 'activity' ? (
                <ActivityDivider key={item.key} msg={item.msg} />
              ) : (
                <ChatMessage
                  key={item.key}
                  msg={item.msg}
                  isOwn={item.isOwn}
                  startsGroup={item.startsGroup}
                  endsGroup={item.endsGroup}
                  animate={index >= animateFromIndex}
                  mediaBlur={mediaBlur}
                />
              )
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {!isAtBottom && <JumpToLatest unseenCount={unseenCount} onClick={() => scrollToBottom()} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(MessageList);
