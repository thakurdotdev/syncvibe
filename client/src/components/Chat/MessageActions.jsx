import { Copy, CornerUpLeft, Info, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
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
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢'];

/** Reply and the "more" menu beside a message: reactions, copy, edit, info and delete. */
const MessageActions = ({ message, isOwn, meId, open, shown, onOpenChange, actions }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const myReaction = message.reactions.find((r) => r.userIds.includes(meId))?.emoji;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center transition-opacity',
        // A mouse shows them on hover and a keyboard on focus; a tap on the message shows them
        // on a touch screen, where they would otherwise sit beside every message.
        open || shown
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:hover)]:group-hover/message:pointer-events-auto [@media(hover:hover)]:group-hover/message:opacity-100'
      )}
    >
      <Button
        variant='ghost'
        size='icon'
        className='h-7 w-7 rounded-full text-muted-foreground'
        onClick={() => actions.reply(message)}
        aria-label='Reply'
        title='Reply'
      >
        <CornerUpLeft className='h-3.5 w-3.5' />
      </Button>

      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7 rounded-full text-muted-foreground'
            aria-label='More actions'
          >
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwn ? 'end' : 'start'} className='w-[212px]'>
          <div className='flex justify-between px-1 py-1'>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type='button'
                onClick={() => {
                  actions.react(message, emoji);
                  onOpenChange(false);
                }}
                aria-label={`React ${emoji}`}
                aria-pressed={myReaction === emoji}
                className={cn(
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-lg transition-transform hover:scale-125',
                  myReaction === emoji && 'bg-primary/15'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />

          {message.body && (
            <DropdownMenuItem className='cursor-pointer' onSelect={() => actions.copy(message)}>
              <Copy className='mr-2 h-4 w-4' />
              Copy text
            </DropdownMenuItem>
          )}
          {isOwn && (
            <DropdownMenuItem className='cursor-pointer' onSelect={() => actions.edit(message)}>
              <Pencil className='mr-2 h-4 w-4' />
              {message.body ? 'Edit' : 'Add a caption'}
            </DropdownMenuItem>
          )}
          {isOwn && (
            <DropdownMenuItem className='cursor-pointer' onSelect={() => actions.info(message)}>
              <Info className='mr-2 h-4 w-4' />
              Message info
            </DropdownMenuItem>
          )}
          {isOwn && (
            <DropdownMenuItem
              className='cursor-pointer text-destructive focus:text-destructive'
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash className='mr-2 h-4 w-4' />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed for both of you. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.remove(message)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessageActions;
