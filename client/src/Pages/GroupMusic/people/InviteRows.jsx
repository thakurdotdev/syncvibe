import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PresenceDot from '@/components/ui/presence-dot';
import { cn } from '@/lib/utils';
import { Check, Clock } from 'lucide-react';
import { memo } from 'react';
import { getInitial } from '../utils/song';

const rowClass = 'flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-foreground/[0.03]';

const Face = ({ src, name, online }) => (
  <span className='relative shrink-0'>
    <Avatar className='h-9 w-9'>
      <AvatarImage src={src} className='object-cover' />
      <AvatarFallback className='bg-accent text-xs font-medium'>{getInitial(name)}</AvatarFallback>
    </Avatar>
    <PresenceDot online={online} />
  </span>
);

const minutesLeft = (expiresAt, now) => Math.max(1, Math.ceil((expiresAt - now) / 60_000));

/** Someone invited who hasn't joined yet. */
export const PendingInviteRow = memo(({ invite, now, isYours }) => (
  <li className={rowClass}>
    <Face src={invite.profilePic} name={invite.userName} />
    <div className='min-w-0 flex-1'>
      <p className='truncate text-sm font-medium'>{invite.userName}</p>
      <p className='truncate text-[11px] text-muted-foreground'>
        Invited by {isYours ? 'you' : invite.invitedByName || 'someone'}
      </p>
    </div>
    <span
      className='flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground'
      title='The invite lapses if they don’t answer'
    >
      <Clock className='h-3 w-3' aria-hidden='true' />
      {minutesLeft(invite.expiresAt, now)} min
    </span>
  </li>
));

/** Someone you could invite. `status` is 'in-room', 'invited' or null. */
export const InviteCandidateRow = memo(({ user, status, disabledReason, onInvite }) => (
  <li className={rowClass}>
    <Face src={user.profilepic} name={user.name} online={Boolean(user.isOnline)} />
    <div className='min-w-0 flex-1'>
      <p className='flex items-center gap-1.5 text-sm font-medium'>
        <span className='truncate'>{user.name}</span>
        {user.isFollowing && (
          <span className='shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-px text-[10px] font-medium text-muted-foreground'>
            Following
          </span>
        )}
      </p>
      <p className='truncate text-[11px] text-muted-foreground'>@{user.username}</p>
    </div>
    {status === 'in-room' ? (
      <span className='shrink-0 text-[11px] text-muted-foreground'>In the room</span>
    ) : status === 'invited' ? (
      <span className='flex shrink-0 items-center gap-1 text-[11px] font-medium text-foreground'>
        <Check className='h-3.5 w-3.5' aria-hidden='true' />
        Invited
      </span>
    ) : (
      <button
        type='button'
        onClick={() => onInvite(user.userid)}
        disabled={Boolean(disabledReason)}
        title={disabledReason || `Invite ${user.name}`}
        aria-label={`Invite ${user.name}`}
        className={cn(
          'h-8 shrink-0 cursor-pointer rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-90',
          'disabled:cursor-not-allowed disabled:opacity-40'
        )}
      >
        Invite
      </button>
    )}
  </li>
));
