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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, LogOut, MoreHorizontal, QrCode } from 'lucide-react';
import { memo, useState } from 'react';

/** Secondary room actions. Chat preferences live in the chat toolbar. */
const RoomMenu = ({ onCopyCode, onShowQrCode, onLeave }) => {
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
        <DropdownMenuContent align='end' className='w-60'>
          <DropdownMenuItem onSelect={onCopyCode}>
            <Copy className='mr-2 h-4 w-4' />
            Copy room code
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onShowQrCode}>
            <QrCode className='mr-2 h-4 w-4' />
            Show QR code
          </DropdownMenuItem>

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
