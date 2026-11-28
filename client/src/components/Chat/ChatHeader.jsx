import { ArrowLeft, Ban, Bell, BellOff, Blend, MoreVertical, UserCheck, Video } from 'lucide-react';
import { useState } from 'react';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import PresenceDot from '../ui/presence-dot';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

/**
 * `onCall` is null while a call is already going on, or the person is blocked. The menu mutes the
 * chat and blocks the person; blocking asks first.
 */
const ChatHeader = ({
  peer,
  online,
  typing,
  onBack,
  onOpenProfile,
  onCall,
  onBlend,
  muted,
  blocked,
  onMute,
  onBlock,
}) => {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const firstName = peer?.name?.split(' ')[0] || 'them';

  return (
    <Card className='sticky top-0 z-10 flex w-full flex-row items-center gap-3 rounded-none border-b p-3 shadow-xs'>
      {onBack && (
        <Button
          onClick={onBack}
          variant='ghost'
          size='icon'
          className='rounded-full'
          aria-label='Back to conversations'
        >
          <ArrowLeft size={20} />
        </Button>
      )}

      <button
        type='button'
        className='flex min-w-0 cursor-pointer items-center gap-3 text-left'
        onClick={onOpenProfile}
      >
        <span className='relative shrink-0'>
          <Avatar className='h-11 w-11'>
            <AvatarImage alt='' src={getProfileCloudinaryUrl(peer?.profilepic)} />
            <AvatarFallback>{peer?.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <PresenceDot online={online} className='ring-card' />
        </span>

        <div className='flex min-w-0 flex-col justify-center'>
          <div className='truncate text-base font-medium text-foreground'>{peer?.name}</div>
          <div className='h-4 text-xs text-muted-foreground' aria-live='polite'>
            {typing ? (
              <span className='font-medium text-foreground'>typing…</span>
            ) : online ? (
              'Online'
            ) : null}
          </div>
        </div>
      </button>

      <div className='ml-auto flex items-center gap-1'>
        {onBlend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-11 w-11 rounded-full'
                aria-label={`Make a Blend with ${peer?.name}`}
                onClick={onBlend}
              >
                <Blend size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Make a Blend</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-11 w-11 rounded-full'
              aria-label={`Video call ${peer?.name}`}
              disabled={!onCall}
              onClick={onCall}
            >
              <Video size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Video call</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-11 w-11 rounded-full'
              aria-label='More options'
            >
              <MoreVertical size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-52'>
            <DropdownMenuItem className='cursor-pointer' onSelect={() => onMute(!muted)}>
              {muted ? <Bell className='mr-2 h-4 w-4' /> : <BellOff className='mr-2 h-4 w-4' />}
              {muted ? 'Unmute notifications' : 'Mute notifications'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {blocked ? (
              <DropdownMenuItem className='cursor-pointer' onSelect={() => onBlock(false)}>
                <UserCheck className='mr-2 h-4 w-4' />
                Unblock {firstName}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className='cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive'
                onSelect={() => setConfirmBlock(true)}
              >
                <Ban className='mr-2 h-4 w-4' />
                Block {firstName}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {peer?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to message or call you, and they won&apos;t be told. You
              can&apos;t message them either until you unblock them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() => onBlock(true)}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ChatHeader;
