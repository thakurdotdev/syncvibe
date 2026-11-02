import { Check, Copy, UserPlus } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import ConnectionStatus from './ConnectionStatus';
import MemberStack from './MemberStack';
import RoomMenu from './RoomMenu';

const COPIED_RESET_MS = 2000;

const useCopyRoomCode = (groupId) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(async () => {
    if (!groupId) return;
    try {
      await navigator.clipboard.writeText(groupId);
      setCopied(true);
      toast.success('Room code copied');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      toast.error('Could not copy the room code');
    }
  }, [groupId]);

  return { copied, copy };
};

const RoomTopBar = ({
  group,
  members,
  connectionQuality,
  isReconnecting,
  onShowPeople,
  onInvite,
  onShowQrCode,
  onLeave,
}) => {
  const { copied, copy } = useCopyRoomCode(group?.id);
  const shortCode = group?.id?.replace('syncvibe_', '') || '';

  return (
    <header className='flex h-14 shrink-0 items-center gap-3 px-1'>
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <h1 className='truncate text-base font-bold tracking-tight md:text-lg'>{group?.name}</h1>
          <ConnectionStatus quality={connectionQuality} isReconnecting={isReconnecting} />
        </div>
        <button
          type='button'
          onClick={copy}
          className='group hidden cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground md:inline-flex'
          aria-label='Copy room code'
        >
          {shortCode}
          {copied ? (
            <Check className='h-3 w-3 text-emerald-500' />
          ) : (
            <Copy className='h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100' />
          )}
        </button>
      </div>

      <MemberStack members={members} onClick={onShowPeople} />

      <button
        type='button'
        onClick={onInvite}
        className='flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-foreground px-3 text-xs font-semibold text-background transition-transform hover:scale-[1.03] sm:px-4'
      >
        <UserPlus className='h-4 w-4' />
        <span className='hidden sm:inline'>Invite</span>
      </button>

      <RoomMenu onCopyCode={copy} onShowQrCode={onShowQrCode} onLeave={onLeave} />
    </header>
  );
};

export default memo(RoomTopBar);
