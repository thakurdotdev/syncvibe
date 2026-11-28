import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { loadStarred, setMessageStarred } from '@/lib/chat';
import { previewOf, useChatStore } from '@/stores/chatStore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

const formatWhen = (iso) => {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** Messages you starred, from every chat, the latest starred first. Click one to go to it. */
const StarredDialog = ({ open, onOpenChange }) => {
  const meId = useChatStore((s) => s.meId);
  const conversations = useChatStore((s) => s.conversations);
  const starred = useChatStore((s) => s.starred);
  const [state, setState] = useState({ messages: null, failed: false });

  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    loadStarred()
      .then((messages) => current && setState({ messages, failed: false }))
      .catch(() => current && setState((s) => ({ ...s, failed: true })));
    return () => {
      current = false;
    };
  }, [open]);

  // Unstarred here or on another device: it leaves the list straight away.
  const shown = state.messages?.filter((m) => starred[m.id]) ?? null;

  const go = (message) => {
    const { requestJump, setActive } = useChatStore.getState();
    requestJump(message.conversationId, message.id);
    setActive(message.conversationId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-3 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Starred messages</DialogTitle>
          <DialogDescription>Star a message from its menu to find it here.</DialogDescription>
        </DialogHeader>

        <ScrollArea className='-mx-2 h-[min(460px,60vh)]'>
          {shown == null ? (
            state.failed ? (
              <p className='px-4 py-10 text-center text-sm text-muted-foreground'>
                Couldn&apos;t load starred messages. Close this and try again.
              </p>
            ) : (
              <div className='space-y-2 px-2'>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className='flex items-center gap-3 px-2 py-2'>
                    <Skeleton className='h-9 w-9 rounded-full' />
                    <div className='flex-1 space-y-2'>
                      <Skeleton className='h-3 w-24 rounded-xs' />
                      <Skeleton className='h-3 w-44 rounded-xs' />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : shown.length === 0 ? (
            <div className='flex flex-col items-center gap-2 px-4 py-12 text-center'>
              <Star className='h-6 w-6 text-muted-foreground' aria-hidden='true' />
              <p className='text-sm font-medium'>No starred messages</p>
            </div>
          ) : (
            <div className='space-y-0.5 px-2'>
              {shown.map((message) => {
                const conversation = conversations.find((c) => c.id === message.conversationId);
                const peer = conversation?.peer;
                const fromMe = message.senderId === meId;
                return (
                  <div
                    key={message.id}
                    className='group flex items-center gap-1 rounded-md hover:bg-muted/70'
                  >
                    <button
                      type='button'
                      onClick={() => go(message)}
                      className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    >
                      <Avatar className='h-9 w-9'>
                        <AvatarImage
                          src={getProfileCloudinaryUrl(peer?.profilepic)}
                          alt=''
                          className='h-9 w-9 rounded-full object-cover'
                        />
                        <AvatarFallback className='h-9 w-9 rounded-full bg-muted text-xs font-semibold'>
                          {peer?.name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className='min-w-0 flex-1'>
                        <span className='flex items-center justify-between gap-2'>
                          <span className='truncate text-sm font-medium'>
                            {fromMe ? `You → ${peer?.name ?? 'Chat'}` : (peer?.name ?? 'Chat')}
                          </span>
                          <span className='shrink-0 text-[11px] tabular-nums text-muted-foreground'>
                            {formatWhen(message.createdAt)}
                          </span>
                        </span>
                        <span className='line-clamp-2 text-xs text-muted-foreground'>
                          {previewOf(message, null)}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 shrink-0 rounded-full'
                      aria-label='Unstar'
                      title='Unstar'
                      onClick={() =>
                        setMessageStarred(message, false).catch(() =>
                          toast.error("Couldn't unstar it. Try again.")
                        )
                      }
                    >
                      <Star className='h-4 w-4 fill-current' />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default StarredDialog;
