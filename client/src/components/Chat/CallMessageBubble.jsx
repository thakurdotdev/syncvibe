import React from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';
import { formatCallDuration, formatTime } from './ChatDateUtils';

const CallMessageBubble = ({ message, isOwnMessage }) => {
  const isMissed = message.messagetype === 'missed_call';
  const isRejected = message.messagetype === 'rejected_call';
  const isCompleted = message.messagetype === 'completed_call';

  const getIcon = () => {
    if (isMissed) return <PhoneMissed className='h-4 w-4 text-red-500' />;
    if (isRejected) return <PhoneOff className='h-4 w-4 text-red-500' />;
    if (isCompleted) return <PhoneIncoming className='h-4 w-4 text-green-500' />;
    return <Phone className='h-4 w-4 text-muted-foreground' />;
  };

  const getLabel = () => {
    if (isMissed) return 'Missed call';
    if (isRejected) return isOwnMessage ? 'Call declined' : 'Declined call';
    if (isCompleted) {
      const dur = formatCallDuration(parseInt(message.content, 10));
      return `Call ended (${dur})`;
    }
    return 'Call';
  };

  const iconColor = isMissed || isRejected ? 'text-red-500' : 'text-green-500';

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs ${
          isOwnMessage
            ? 'bg-primary/10 border border-primary/20 text-foreground'
            : 'bg-muted/80 border border-border text-foreground'
        }`}
      >
        <span className={iconColor}>{getIcon()}</span>
        <span className='font-medium'>{getLabel()}</span>
        <span className='text-[10px] text-muted-foreground ml-1'>
          {formatTime(message.createdat)}
        </span>
      </div>
    </div>
  );
};

export default CallMessageBubble;
