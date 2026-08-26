import React from 'react';
import { AlertCircle, Check, Clock } from 'lucide-react';
import { getOptimizedImageUrl } from '@/Utils/Cloudinary';
import { formatTime } from './ChatDateUtils';
import MessageActions from './MessageActions';

const MessageBubble = ({
  message,
  isOwnMessage,
  handleCopy,
  deleteMessage,
  onRetry,
  onShowInfo,
  chatImages,
  setSelectedImageIndex,
  setShowGallery,
}) => {
  const isMediaOnly = message.fileurl && !message.content?.trim();

  const renderStatusIcon = () => {
    if (!isOwnMessage) return null;

    if (message.status === 'pending') {
      return <Clock className='w-3 h-3 text-muted-foreground animate-pulse' />;
    }

    if (message.status === 'failed') {
      return (
        <button
          onClick={() => onRetry && onRetry(message)}
          title='Failed to send. Click to retry.'
          className='text-destructive hover:opacity-80 flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0'
        >
          <AlertCircle className='w-3.5 h-3.5' />
          <span className='text-[10px] font-medium underline'>Retry</span>
        </button>
      );
    }

    if (message.isread) {
      return (
        <div className='flex text-blue-500'>
          <Check size={13} />
          <Check size={13} className='-ml-2' />
        </div>
      );
    }

    return <Check size={13} className='text-muted-foreground/70' />;
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div
        className={`max-w-[75%] md:max-w-[60%] flex flex-col ${
          isOwnMessage ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`relative ${
            isMediaOnly
              ? ''
              : `px-3 py-2 rounded-lg ${
                  isOwnMessage
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted dark:bg-muted/70 text-foreground'
                }`
          }`}
        >
          <MessageActions
            message={message}
            isOwnMessage={isOwnMessage}
            handleCopy={handleCopy}
            deleteMessage={deleteMessage}
            onShowInfo={onShowInfo}
          />

          {message.fileurl && (
            <div className={`${isMediaOnly ? '' : 'mb-2'} rounded-lg overflow-hidden`}>
              <img
                src={getOptimizedImageUrl(message.fileurl, { thumbnail: true })}
                alt='Attachment'
                className='max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity'
                onClick={() => {
                  const imageIndex = chatImages.indexOf(message.fileurl);
                  setSelectedImageIndex(imageIndex);
                  setShowGallery(true);
                }}
                loading='lazy'
              />
            </div>
          )}

          {message.content && (
            <div className='text-sm font-normal whitespace-pre-wrap wrap-break-word'>
              {message.content}
            </div>
          )}
        </div>

        <div className='flex items-center gap-1 text-xs text-muted-foreground mt-1 px-1'>
          {formatTime(message.createdat)}
          {isOwnMessage && <div className='flex items-center ml-1'>{renderStatusIcon()}</div>}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
