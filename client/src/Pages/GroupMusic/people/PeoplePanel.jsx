import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, UserPlus } from 'lucide-react';
import { memo, useMemo } from 'react';
import { PanelBody } from '../components/Panel';
import { getInitial } from '../utils/song';

const isSameUser = (a, b) => a != null && b != null && String(a) === String(b);

const MemberRow = memo(({ member, isHost, isYou }) => (
  <motion.li
    layout
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className={cn(
      'flex items-center gap-3 rounded-xl px-2.5 py-2',
      isYou ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.03]'
    )}
  >
    <div className='relative shrink-0'>
      <Avatar className='h-9 w-9'>
        <AvatarImage src={member.profilePic} />
        <AvatarFallback className='bg-accent text-xs font-medium'>
          {getInitial(member.userName)}
        </AvatarFallback>
      </Avatar>
      <span
        className='absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-foreground'
        aria-hidden='true'
      />
    </div>
    <div className='min-w-0 flex-1'>
      <p className='flex items-center gap-1.5 text-sm font-medium'>
        <span className='truncate'>{member.userName}</span>
        {isYou && <span className='shrink-0 text-xs font-normal text-muted-foreground'>(you)</span>}
      </p>
      <p
        className={cn(
          'flex items-center gap-1 text-[11px]',
          isHost ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {isHost && <Crown className='h-3 w-3' aria-hidden='true' />}
        {member.connected === false ? 'Reconnecting…' : isHost ? 'Host' : 'Listening'}
      </p>
    </div>
  </motion.li>
));

const PeoplePanel = ({ members, currentUserId, hostId, maxMembers, onInvite }) => {
  // Host first, then you, then everyone else in join order.
  const sortedMembers = useMemo(() => {
    const rank = (m) =>
      isSameUser(m.userId, hostId) ? 0 : isSameUser(m.userId, currentUserId) ? 1 : 2;
    return [...members].sort((a, b) => rank(a) - rank(b));
  }, [members, hostId, currentUserId]);

  const isFull = maxMembers > 0 && members.length >= maxMembers;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex shrink-0 items-center justify-between gap-3 px-4 py-3'>
        <p className='text-xs text-muted-foreground'>
          <span className='font-semibold text-foreground'>{members.length}</span>
          {maxMembers ? ` of ${maxMembers}` : ''} listening
        </p>
        <button
          type='button'
          onClick={onInvite}
          disabled={isFull}
          title={isFull ? 'Room is full' : 'Invite friends'}
          className='flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-xs font-medium transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <UserPlus className='h-3.5 w-3.5' />
          Invite
        </button>
      </div>
      <PanelBody className='px-2 pb-2'>
        <ul className='space-y-0.5'>
          <AnimatePresence initial={false}>
            {sortedMembers.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isHost={isSameUser(member.userId, hostId)}
                isYou={isSameUser(member.userId, currentUserId)}
              />
            ))}
          </AnimatePresence>
        </ul>
      </PanelBody>
    </div>
  );
};

export default memo(PeoplePanel);
