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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, LogOut, Minus, MoreHorizontal, Plus, QrCode } from 'lucide-react';
import { memo, useState } from 'react';

const OFFSET_STEP_MS = 25;

const StepButton = ({ label, onClick, children }) => (
  <button
    type='button'
    aria-label={label}
    onClick={onClick}
    className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground/[0.06] text-foreground transition-colors hover:bg-foreground/10'
  >
    {children}
  </button>
);

/**
 * Bluetooth speakers and some TVs play a moment late. This moves this device's sound earlier (or
 * later) so it lands with everyone else's.
 */
const SpeakerDelay = ({ valueMs = 0, onChange }) => (
  <div className='px-2 py-1.5'>
    <div className='flex items-center justify-between gap-2'>
      <span className='text-sm'>Speaker delay</span>
      <div className='flex items-center gap-2'>
        <StepButton label='Play later' onClick={() => onChange(valueMs - OFFSET_STEP_MS)}>
          <Minus className='h-3.5 w-3.5' />
        </StepButton>
        <button
          type='button'
          onClick={() => onChange(0)}
          title='Reset'
          className='w-14 cursor-pointer text-center font-mono text-xs tabular-nums text-muted-foreground hover:text-foreground'
        >
          {valueMs > 0 ? '+' : ''}
          {valueMs} ms
        </button>
        <StepButton label='Play earlier' onClick={() => onChange(valueMs + OFFSET_STEP_MS)}>
          <Plus className='h-3.5 w-3.5' />
        </StepButton>
      </div>
    </div>
    <p className='mt-1 text-[11px] leading-snug text-muted-foreground'>
      On Bluetooth and hearing an echo with others nearby? Raise this until it lines up.
    </p>
  </div>
);

/** Secondary room actions. Chat preferences live in the chat toolbar. */
const RoomMenu = ({
  onCopyCode,
  onShowQrCode,
  onLeave,
  isHost,
  controlMode,
  onSetControlMode,
  outputOffsetMs,
  onSetOutputOffset,
}) => {
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            aria-label='Room options'
            className='flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
          >
            <MoreHorizontal className='h-4 w-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-64'>
          <DropdownMenuItem onSelect={onCopyCode}>
            <Copy className='mr-2 h-4 w-4' />
            Copy room code
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onShowQrCode}>
            <QrCode className='mr-2 h-4 w-4' />
            Show QR code
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          {isHost && (
            <DropdownMenuCheckboxItem
              checked={controlMode === 'host'}
              onCheckedChange={(checked) => onSetControlMode?.(checked ? 'host' : 'everyone')}
              onSelect={(event) => event.preventDefault()}
            >
              Only I control playback
            </DropdownMenuCheckboxItem>
          )}
          {onSetOutputOffset && (
            <SpeakerDelay valueMs={outputOffsetMs} onChange={onSetOutputOffset} />
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
            Shortcuts
          </DropdownMenuLabel>
          <DropdownMenuItem disabled className='opacity-100'>
            Play / pause <DropdownMenuShortcut>Space</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className='opacity-100'>
            Focus chat <DropdownMenuShortcut>/</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirmLeave(true)}
            className='text-destructive focus:bg-destructive/10 focus:text-destructive'
          >
            <LogOut className='mr-2 h-4 w-4' />
            Leave room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this room?</AlertDialogTitle>
            <AlertDialogDescription>
              Playback will stop for you. You can rejoin any time with the room code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='cursor-pointer'>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onLeave()}
              className='cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Leave room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(RoomMenu);
