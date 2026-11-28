import { Search, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { refreshConversations } from '@/lib/chat';
import { useChatStore } from '@/stores/chatStore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

/**
 * Picks one of your conversations, for a song or a message to go to.
 * `excludeId` leaves one out: the conversation a message is forwarded from.
 */
const SendToChatDialog = ({ open, onOpenChange, title, subtitle, onPick, excludeId }) => {
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) void refreshConversations();
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        c.id !== excludeId &&
        !c.blocked &&
        (!q || c.peer.name?.toLowerCase().includes(q) || c.peer.username?.toLowerCase().includes(q))
    );
  }, [conversations, query, excludeId]);

  // The search starts empty the next time it opens.
  const changeOpen = (next) => {
    if (!next) setQuery('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className='gap-3 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription className='truncate'>{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className='sr-only'>Pick a conversation</DialogDescription>
          )}
        </DialogHeader>

        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search your chats'
            aria-label='Search your chats'
            className='pl-9'
          />
        </div>

        <ScrollArea className='-mx-2 h-[min(420px,55vh)]'>
          {!loaded && conversations.length === 0 ? (
            <div className='space-y-1 px-2'>
              {[...Array(5)].map((_, i) => (
                <div key={i} className='flex items-center gap-3 px-2 py-2'>
                  <Skeleton className='h-9 w-9 rounded-full' />
                  <Skeleton className='h-3.5 w-32 rounded-xs' />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className='px-4 py-10 text-center text-sm text-muted-foreground'>
              {query.trim()
                ? `No chats match "${query.trim()}"`
                : 'Start a chat from Messages first.'}
            </p>
          ) : (
            <div className='space-y-0.5 px-2'>
              {shown.map((c) => (
                <button
                  key={c.id}
                  type='button'
                  onClick={() => {
                    setQuery('');
                    onPick(c);
                  }}
                  className='group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring'
                >
                  <Avatar className='h-9 w-9'>
                    <AvatarImage
                      src={getProfileCloudinaryUrl(c.peer.profilepic)}
                      alt=''
                      className='h-9 w-9 rounded-full object-cover'
                    />
                    <AvatarFallback className='h-9 w-9 rounded-full bg-muted text-xs font-semibold'>
                      {c.peer.name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-medium'>{c.peer.name}</span>
                    {c.peer.username && (
                      <span className='block truncate text-xs text-muted-foreground'>
                        @{c.peer.username}
                      </span>
                    )}
                  </span>
                  <Send className='h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100' />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SendToChatDialog;
