import { cn } from '@/lib/utils';
import {
  Crown,
  Info,
  ListPlus,
  MessageSquareOff,
  Music2,
  Play,
  Shield,
  SkipForward,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { memo } from 'react';
import { formatMessageTime } from './chatUtils';

const ACTIVITY_META = {
  'song-playing': { Icon: Play, tone: 'text-foreground' },
  'song-added': { Icon: ListPlus, tone: 'text-foreground' },
  'song-skipped': { Icon: SkipForward, tone: 'text-foreground' },
  'queue-ended': { Icon: Music2, tone: 'text-foreground' },
  'user-joined': { Icon: UserPlus, tone: 'text-foreground' },
  'user-left': { Icon: UserMinus, tone: 'text-destructive' },
  'host-changed': { Icon: Crown, tone: 'text-foreground' },
  'cohost-added': { Icon: Shield, tone: 'text-foreground' },
  'cohost-removed': { Icon: Shield, tone: 'text-muted-foreground' },
  'member-muted': { Icon: MessageSquareOff, tone: 'text-muted-foreground' },
  'member-removed': { Icon: UserMinus, tone: 'text-destructive' },
  'skip-vote': { Icon: SkipForward, tone: 'text-muted-foreground' },
  'skipped-by-vote': { Icon: SkipForward, tone: 'text-foreground' },
};

const DEFAULT_META = { Icon: Info, tone: 'text-muted-foreground' };

/** Low-emphasis, single-line system event (joins, skips, now playing…). */
const ActivityDivider = ({ msg }) => {
  const { Icon, tone } = ACTIVITY_META[msg.activityType] || DEFAULT_META;
  const isNowPlaying = msg.activityType === 'song-playing';

  return (
    <div className='flex items-center gap-2 px-3 py-2'>
      <span className='h-px flex-1 bg-border/40' aria-hidden='true' />
      <span
        className={cn(
          'flex min-w-0 max-w-[85%] items-center gap-1.5 text-[11px] text-muted-foreground',
          isNowPlaying && 'font-medium text-foreground/80'
        )}
      >
        <Icon className={cn('h-3 w-3 shrink-0', tone)} aria-hidden='true' />
        <span className='truncate' title={msg.message}>
          {msg.message}
        </span>
        {msg.timestamp && (
          <span className='shrink-0 text-muted-foreground/50'>
            · {formatMessageTime(msg.timestamp)}
          </span>
        )}
      </span>
      <span className='h-px flex-1 bg-border/40' aria-hidden='true' />
    </div>
  );
};

export default memo(ActivityDivider);
