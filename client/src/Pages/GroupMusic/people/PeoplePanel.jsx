import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Crown,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { PanelBody } from '../components/Panel';
import { getInitial } from '../utils/song';

const isSameUser = (a, b) => a != null && b != null && String(a) === String(b);
const inList = (list, id) => id != null && Boolean(list?.includes(String(id)));

const statusOf = (member, role, muted) => {
  if (member.connected === false) return 'Reconnecting…';
  const label = role === 'host' ? 'Host' : role === 'cohost' ? 'Co-host' : 'Listening';
  return muted ? `${label} · Muted` : label;
};

const MemberActions = ({ member, role, muted, actions, onConfirmRemove }) => {
  const { canPromote, canModerate, onMakeHost, onSetCoHost, onMute } = actions;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          aria-label={`Options for ${member.userName}`}
          className='flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
        >
          <MoreHorizontal className='h-4 w-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-52'>
        {canPromote && (
          <>
            <DropdownMenuItem onSelect={() => onSetCoHost(member.userId, role !== 'cohost')}>
              {role === 'cohost' ? (
                <ShieldOff className='mr-2 h-4 w-4' />
              ) : (
                <Shield className='mr-2 h-4 w-4' />
              )}
              {role === 'cohost' ? 'Remove as co-host' : 'Make co-host'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMakeHost(member.userId)}>
              <Crown className='mr-2 h-4 w-4' />
              Make host
            </DropdownMenuItem>
          </>
        )}
        {canPromote && canModerate && <DropdownMenuSeparator />}
        {canModerate && (
          <>
            <DropdownMenuItem onSelect={() => onMute(member.userId, !muted)}>
              {muted ? (
                <MessageSquare className='mr-2 h-4 w-4' />
              ) : (
                <MessageSquareOff className='mr-2 h-4 w-4' />
              )}
              {muted ? 'Let them chat' : 'Mute in chat'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onConfirmRemove(member)}
              className='text-destructive focus:bg-destructive/10 focus:text-destructive'
            >
              <UserMinus className='mr-2 h-4 w-4' />
              Remove from room
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const MemberRow = memo(({ member, role, muted, isYou, actions, onConfirmRemove }) => (
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
          role === 'listener' ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {role === 'host' && <Crown className='h-3 w-3' aria-hidden='true' />}
        {role === 'cohost' && <Shield className='h-3 w-3' aria-hidden='true' />}
        {statusOf(member, role, muted)}
      </p>
    </div>
    {actions && (
      <MemberActions
        member={member}
        role={role}
        muted={muted}
        actions={actions}
        onConfirmRemove={onConfirmRemove}
      />
    )}
  </motion.li>
));

/**
 * Everyone in the room. The host can make co-hosts or hand the room over; the host and co-hosts
 * can mute or remove listeners. The server checks all of it; this only decides what's offered.
 */
const PeoplePanel = ({
  members,
  currentUserId,
  hostId,
  coHosts,
  mutedIds,
  maxMembers,
  onInvite,
  onMakeHost,
  onSetCoHost,
  onMute,
  onRemove,
}) => {
  const [removing, setRemoving] = useState(null);
  const youAreHost = isSameUser(currentUserId, hostId);
  const youAreCoHost = inList(coHosts, currentUserId);

  const roleOf = (id) =>
    isSameUser(id, hostId) ? 'host' : inList(coHosts, id) ? 'cohost' : 'listener';

  // Host first, then co-hosts, then you, then everyone else in join order.
  const sortedMembers = useMemo(() => {
    const rank = (m) =>
      isSameUser(m.userId, hostId)
        ? 0
        : inList(coHosts, m.userId)
          ? 1
          : isSameUser(m.userId, currentUserId)
            ? 2
            : 3;
    return [...members].sort((a, b) => rank(a) - rank(b));
  }, [members, hostId, coHosts, currentUserId]);

  /** What you may do to this person, or null for nothing. */
  const actionsFor = (member) => {
    if (isSameUser(member.userId, currentUserId) || isSameUser(member.userId, hostId)) return null;
    const role = roleOf(member.userId);
    const canPromote = youAreHost && Boolean(onSetCoHost && onMakeHost);
    const canModerate = youAreHost || (youAreCoHost && role === 'listener');
    if (!canPromote && !canModerate) return null;
    return { canPromote, canModerate, onMakeHost, onSetCoHost, onMute };
  };

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
                role={roleOf(member.userId)}
                muted={inList(mutedIds, member.userId)}
                isYou={isSameUser(member.userId, currentUserId)}
                actions={actionsFor(member)}
                onConfirmRemove={setRemoving}
              />
            ))}
          </AnimatePresence>
        </ul>
      </PanelBody>

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll leave the room on all their devices and can’t rejoin with the code. Invite
              them to let them back in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='cursor-pointer'>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && onRemove?.(removing.userId)}
              className='cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default memo(PeoplePanel);
