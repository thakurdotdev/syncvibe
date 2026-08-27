import React, { useMemo } from 'react';
import { MessageSquareDashed } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { groupMessagesByDate } from './ChatDateUtils';
import DateSeparator from './DateSeparator';
import CallMessageBubble from './CallMessageBubble';
import MessageBubble from './MessageBubble';

const MessageListSkeleton = () => (
  <div className='flex-1 p-4 space-y-5 overflow-hidden'>
    {/* Date separator shimmer */}
    <div className='flex justify-center my-2'>
      <Skeleton className='h-5 w-24 rounded-full' />
    </div>

    {/* Incoming message */}
    <div className='flex items-end gap-2.5 max-w-[75%]'>
      <Skeleton className='w-8 h-8 rounded-full shrink-0' />
      <div className='space-y-1.5'>
        <Skeleton className='h-11 w-52 rounded-2xl rounded-bl-sm' />
        <Skeleton className='h-2.5 w-12 rounded-sm ml-1' />
      </div>
    </div>

    {/* Outgoing message */}
    <div className='flex flex-col items-end gap-1.5 ml-auto max-w-[75%]'>
      <Skeleton className='h-14 w-64 rounded-2xl rounded-br-sm bg-primary/20' />
      <Skeleton className='h-2.5 w-12 rounded-sm mr-1' />
    </div>

    {/* Incoming message */}
    <div className='flex items-end gap-2.5 max-w-[75%]'>
      <Skeleton className='w-8 h-8 rounded-full shrink-0' />
      <div className='space-y-1.5'>
        <Skeleton className='h-20 w-60 rounded-2xl rounded-bl-sm' />
        <Skeleton className='h-2.5 w-12 rounded-sm ml-1' />
      </div>
    </div>

    {/* Outgoing message */}
    <div className='flex flex-col items-end gap-1.5 ml-auto max-w-[75%]'>
      <Skeleton className='h-9 w-36 rounded-2xl rounded-br-sm bg-primary/20' />
      <Skeleton className='h-2.5 w-12 rounded-sm mr-1' />
    </div>

    {/* Incoming message */}
    <div className='flex items-end gap-2.5 max-w-[75%]'>
      <Skeleton className='w-8 h-8 rounded-full shrink-0' />
      <div className='space-y-1.5'>
        <Skeleton className='h-10 w-44 rounded-2xl rounded-bl-sm' />
        <Skeleton className='h-2.5 w-12 rounded-sm ml-1' />
      </div>
    </div>
  </div>
);

const MessageList = ({
  messages,
  loading,
  loggedInUserId,
  handleCopy,
  deleteMessage,
  onRetry,
  onShowInfo,
  chatImages,
  setSelectedImageIndex,
  setShowGallery,
  currentChat,
  messageEndRef,
}) => {
  const groupedMessages = useMemo(() => {
    const grouped = groupMessagesByDate(messages);
    return Object.entries(grouped).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));
  }, [messages]);

  if (loading) {
    return <MessageListSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className='flex-1 flex flex-col justify-center items-center p-6'>
        <div className='flex flex-col items-center gap-4 text-center max-w-sm'>
          <div className='p-4 rounded-full bg-muted/60 text-muted-foreground ring-8 ring-muted/20'>
            <MessageSquareDashed className='w-8 h-8' />
          </div>
          <div className='space-y-1.5'>
            <h3 className='text-lg font-semibold text-foreground'>No messages yet</h3>
            <p className='text-xs text-muted-foreground leading-relaxed'>
              Send a message to start the conversation with{' '}
              <span className='font-medium text-foreground'>
                {currentChat?.otherUser?.name || 'this user'}
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className='flex-1 p-4'>
      <div className='space-y-4'>
        {groupedMessages.map(([date, dateMessages]) => (
          <div key={date} className='space-y-2'>
            <DateSeparator date={date} />

            {dateMessages
              .sort((a, b) => new Date(a.createdat) - new Date(b.createdat))
              .map((message, index) => {
                const isCallMessage = ['missed_call', 'completed_call', 'rejected_call'].includes(
                  message.messagetype
                );

                if (isCallMessage) {
                  return (
                    <CallMessageBubble
                      key={message.messageid || index}
                      message={message}
                      isOwnMessage={String(message.senderid) === String(loggedInUserId)}
                    />
                  );
                }

                return (
                  <MessageBubble
                    key={message.messageid || index}
                    message={message}
                    isOwnMessage={String(message.senderid) === String(loggedInUserId)}
                    handleCopy={handleCopy}
                    deleteMessage={deleteMessage}
                    onRetry={onRetry}
                    onShowInfo={onShowInfo}
                    chatImages={chatImages}
                    setSelectedImageIndex={setSelectedImageIndex}
                    setShowGallery={setShowGallery}
                  />
                );
              })}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
    </ScrollArea>
  );
};

export default MessageList;
