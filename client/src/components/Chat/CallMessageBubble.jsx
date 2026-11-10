import { PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';
import { formatCallDuration, formatTime } from './ChatDateUtils';

const CallMessageBubble = ({ message, isOwnMessage }) => {
  const outcome = message.call?.outcome;
  const failed = outcome === 'missed' || outcome === 'rejected';
  const Icon =
    outcome === 'missed' ? PhoneMissed : outcome === 'rejected' ? PhoneOff : PhoneIncoming;

  const label =
    outcome === 'missed'
      ? isOwnMessage
        ? 'No answer'
        : 'Missed call'
      : outcome === 'rejected'
        ? isOwnMessage
          ? 'Call declined'
          : 'Declined call'
        : `Call ended (${formatCallDuration(message.call?.durationSec)})`;

  return (
    <div className={`mb-2 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs ${
          isOwnMessage
            ? 'border border-primary/20 bg-primary/10 text-foreground'
            : 'border border-border bg-muted/80 text-foreground'
        }`}
      >
        <Icon className={`h-4 w-4 ${failed ? 'text-destructive' : 'text-foreground'}`} />
        <span className='font-medium'>{label}</span>
        <span className='ml-1 text-[10px] text-muted-foreground'>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
};

export default CallMessageBubble;
