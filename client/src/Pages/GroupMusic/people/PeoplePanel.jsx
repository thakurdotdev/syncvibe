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
import PresenceDot from '@/components/ui/presence-dot';
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
  Loader2,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  UserMinus,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelBody, PanelHeader } from '../components/Panel';
import { useRoomUi } from '../hooks/useRoomUi';
import { getInitial } from '../utils/song';
import { InviteCandidateRow, PendingInviteRow } from './InviteRows';
import { useInviteSearch } from './useInviteSearch';

const NO_INVITES = [];
const SUGGESTION_COUNT = 8;
/** How long a tapped Invite shows as sent before the room confirms it (or an error explains). */
const SENDING_GRACE_MS = 8_000;

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
      <PresenceDot online={member.connected !== false} />
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

const SectionTitle = ({ children }) => (
  <p className='px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60'>
    {children}
  </p>
);

const InviteSearchField = ({ value, isLoading, focusRequest, onChange, onClear }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusRequest) inputRef.current?.focus();
  }, [focusRequest]);

  return (
    <div className='relative'>
      <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60' />
      <input
        ref={inputRef}
        type='search'
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onClear();
          }
        }}
        placeholder='Invite people by name…'
        aria-label='Search people to invite'
        className='h-10 w-full rounded-xl border border-border/40 bg-background/60 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border [&::-webkit-search-cancel-button]:hidden'
      />
      <div className='absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center'>
        {isLoading ? (
          <Loader2
            className='mr-1.5 h-4 w-4 animate-spin text-muted-foreground'
            aria-label='Searching'
          />
        ) : (
          value && (
            <button
              type='button'
              onClick={onClear}
              aria-label='Clear search'
              className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )
        )}
      </div>
    </div>
  );
};

const CandidateSkeleton = () => (
  <ul className='space-y-0.5' aria-hidden='true'>
    {[0, 1, 2].map((i) => (
      <li key={i} className='flex items-center gap-3 px-2.5 py-2'>
        <div className='skeleton-block h-9 w-9 shrink-0 rounded-full' />
        <div className='min-w-0 flex-1 space-y-1.5'>
          <div className='skeleton-line h-3 w-2/5' />
          <div className='skeleton-line h-2.5 w-1/4' />
        </div>
      </li>
    ))}
  </ul>
);

/** Re-renders every half minute while invites are counting down. */
const useNow = (active) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
};

/**
 * Everyone in the room, who's been invited, and a search to invite more, all in one place.
 * The host can make co-hosts or hand the room over; the host and co-hosts can mute or remove
 * listeners. The server checks all of it; this only decides what's offered.
 */
const PeoplePanel = ({
  members,
  currentUserId,
  hostId,
  coHosts,
  mutedIds,
  maxMembers,
  pendingInvites = NO_INVITES,
  onSendInvite,
  onMakeHost,
  onSetCoHost,
  onMute,
  onRemove,
}) => {
  const [removing, setRemoving] = useState(null);
  // Tapped Invite recently: shown as invited until the room's own list has it.
  const [sending, setSending] = useState(() => new Set());
  const youAreHost = isSameUser(currentUserId, hostId);
  const youAreCoHost = inList(coHosts, currentUserId);
  const focusRequest = useRoomUi((s) => s.inviteFocusRequest);
  const search = useInviteSearch();
  const now = useNow(pendingInvites.length > 0);

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

  const memberIds = useMemo(() => new Set(members.map((m) => String(m.userId))), [members]);
  const invitedIds = useMemo(
    () => new Set(pendingInvites.map((invite) => String(invite.userId))),
    [pendingInvites]
  );

  const handleInvite = useCallback(
    (userId) => {
      const id = String(userId);
      setSending((prev) => new Set(prev).add(id));
      onSendInvite?.(userId);
      // If the room refuses (it says why in a toast), offer the button again.
      setTimeout(() => {
        setSending((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, SENDING_GRACE_MS);
    },
    [onSendInvite]
  );

  const statusOfCandidate = (userId) => {
    const id = String(userId);
    if (memberIds.has(id)) return 'in-room';
    if (invitedIds.has(id) || sending.has(id)) return 'invited';
    return null;
  };

  const suggestions = useMemo(
    () =>
      search.users
        .filter((u) => !memberIds.has(String(u.userid)) && !invitedIds.has(String(u.userid)))
        .slice(0, SUGGESTION_COUNT),
    [search.users, memberIds, invitedIds]
  );

  const candidateRows = (users) => (
    <ul className='space-y-0.5'>
      {users.map((u) => (
        <InviteCandidateRow
          key={u.userid}
          user={u}
          status={statusOfCandidate(u.userid)}
          disabledReason={isFull ? 'The room is full' : null}
          onInvite={handleInvite}
        />
      ))}
    </ul>
  );

  const searchResults = () => {
    if (search.isLoading && search.users.length === 0) return <CandidateSkeleton />;
    if (search.users.length === 0) {
      return (
        <p className='px-2.5 py-8 text-center text-xs text-muted-foreground'>
          No one found for “{search.query.trim()}”.
        </p>
      );
    }
    return candidateRows(search.users);
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <PanelHeader className='space-y-2.5'>
        <p className='px-1 text-xs text-muted-foreground'>
          <span className='font-semibold text-foreground'>{members.length}</span>
          {maxMembers ? ` of ${maxMembers}` : ''} listening
          {isFull && <span> · room is full</span>}
        </p>
        <InviteSearchField
          value={search.query}
          isLoading={search.isLoading && search.isSearching}
          focusRequest={focusRequest}
          onChange={search.handleChange}
          onClear={search.clear}
        />
      </PanelHeader>

      <PanelBody className='px-2 pb-2'>
        {search.isSearching ? (
          <>
            <SectionTitle>Invite</SectionTitle>
            {searchResults()}
          </>
        ) : (
          <>
            <SectionTitle>In the room</SectionTitle>
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

            {pendingInvites.length > 0 && (
              <>
                <SectionTitle>Invited · {pendingInvites.length}</SectionTitle>
                <ul className='space-y-0.5'>
                  {pendingInvites.map((invite) => (
                    <PendingInviteRow
                      key={invite.userId}
                      invite={invite}
                      now={now}
                      isYours={isSameUser(invite.invitedById, currentUserId)}
                    />
                  ))}
                </ul>
              </>
            )}

            {!search.hasLoaded ? (
              <>
                <SectionTitle>Suggested</SectionTitle>
                <CandidateSkeleton />
              </>
            ) : (
              suggestions.length > 0 && (
                <>
                  <SectionTitle>Suggested</SectionTitle>
                  {candidateRows(suggestions)}
                </>
              )
            )}
          </>
        )}
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
