import axios from 'axios';
import { LucideX, MessageSquarePlus, Search, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProfileCloudinaryUrl } from '@/Utils/Cloudinary';
import { openConversationWith } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { previewOf, useChatStore } from '@/stores/chatStore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { formatListTime } from './ChatDateUtils';

const SEARCH_DELAY_MS = 400;

const ListSkeleton = () => (
  <div className='space-y-1 p-1'>
    {[...Array(7)].map((_, i) => (
      <div key={i} className='flex items-center gap-3 rounded-md px-3 py-2.5'>
        <Skeleton className='h-11 w-11 shrink-0 rounded-full' />
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex items-center justify-between'>
            <Skeleton className='h-3.5 w-28 rounded-xs' />
            <Skeleton className='h-3 w-8 rounded-xs' />
          </div>
          <Skeleton className='h-3 w-40 rounded-xs' />
        </div>
      </div>
    ))}
  </div>
);

const Row = ({ person, selected, online, onSelect, title, subtitle, time, unread }) => (
  <button
    type='button'
    onClick={onSelect}
    className={cn(
      'group flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring',
      selected
        ? 'bg-accent/80 text-accent-foreground dark:bg-accent/60'
        : 'text-foreground hover:bg-muted/70 dark:hover:bg-muted/50'
    )}
  >
    <Avatar className='relative h-11 w-11 shrink-0 ring-1 ring-border/40 group-hover:ring-border/80'>
      <AvatarImage
        src={getProfileCloudinaryUrl(person?.profilepic)}
        alt=''
        className='h-11 w-11 rounded-full object-cover'
      />
      <AvatarFallback className='h-11 w-11 rounded-full bg-muted text-xs font-semibold'>
        {person?.name?.[0] || 'U'}
      </AvatarFallback>
      {online != null && (
        <span
          title={online ? 'Online' : 'Offline'}
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
            online ? 'bg-foreground' : 'bg-muted-foreground/30'
          )}
        />
      )}
    </Avatar>

    <div className='ml-3 flex min-w-0 flex-1 flex-col'>
      <div className='flex items-center justify-between gap-1.5'>
        <span
          className={cn('truncate text-sm', unread || selected ? 'font-semibold' : 'font-medium')}
        >
          {title}
        </span>
        {time && <span className='shrink-0 text-[11px] text-muted-foreground'>{time}</span>}
      </div>
      <div className='flex items-center justify-between gap-1.5'>
        <div className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>{subtitle}</div>
        {unread > 0 && (
          <Badge
            variant='default'
            className='h-4 min-w-4 shrink-0 rounded-full px-1.5 text-[10px] font-bold'
          >
            {unread > 99 ? '99+' : unread}
          </Badge>
        )}
      </div>
    </div>
  </button>
);

const Empty = ({ icon: Icon, title, hint }) => (
  <div className='flex h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground'>
    <div className='rounded-full bg-muted/60 p-3.5'>
      <Icon className='h-7 w-7 text-muted-foreground/80' />
    </div>
    <div className='space-y-1'>
      <p className='text-sm font-semibold text-foreground'>{title}</p>
      <p className='max-w-[200px] text-xs text-muted-foreground'>{hint}</p>
    </div>
  </div>
);

const ConversationList = () => {
  const meId = useChatStore((s) => s.meId);
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const activeId = useChatStore((s) => s.activeId);
  const presence = useChatStore((s) => s.presence);
  const typing = useChatStore((s) => s.typing);
  const setActive = useChatStore((s) => s.setActive);

  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const term = query.trim();

  const changeQuery = (value) => {
    setQuery(value);
    setSearching(Boolean(value.trim()));
  };

  useEffect(() => {
    if (!term) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      axios
        .get(`${import.meta.env.VITE_API_URL}/api/user/search`, {
          params: { name: term },
          withCredentials: true,
          signal: controller.signal,
        })
        .then(({ data }) => {
          setPeople(data.users || []);
          setSearching(false);
        })
        .catch((error) => {
          if (axios.isCancel(error)) return;
          setPeople([]);
          setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const startWith = async (person) => {
    try {
      const conversation = await openConversationWith(person.userid);
      setActive(conversation.id);
      changeQuery('');
    } catch (error) {
      toast.error(error?.response?.data?.message || "Couldn't open that conversation");
    }
  };

  const renderBody = () => {
    if (term) {
      if (searching) return <ListSkeleton />;
      if (!people.length) {
        return <Empty icon={UserX} title='No one found' hint='Try a different name' />;
      }
      return (
        <div className='space-y-0.5 p-1'>
          {people.map((person) => (
            <Row
              key={person.userid}
              person={person}
              title={person.name}
              subtitle={`@${person.username || 'user'}`}
              onSelect={() => startWith(person)}
            />
          ))}
        </div>
      );
    }

    if (!loaded) return <ListSkeleton />;
    if (!conversations.length) {
      return (
        <Empty
          icon={MessageSquarePlus}
          title='No conversations yet'
          hint='Search above to find someone and say hello.'
        />
      );
    }
    return (
      <div className='space-y-0.5 p-1'>
        {conversations.map((c) => (
          <Row
            key={c.id}
            person={c.peer}
            selected={c.id === activeId}
            online={Boolean(presence[c.peer.userid])}
            title={c.peer.name}
            subtitle={
              typing[c.id] ? (
                <span className='font-medium text-foreground'>typing…</span>
              ) : (
                previewOf(c.lastMessage, meId) || 'No messages yet'
              )
            }
            time={c.lastMessageAt ? formatListTime(c.lastMessageAt) : null}
            unread={c.id === activeId ? 0 : c.unreadCount}
            onSelect={() => setActive(c.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className='flex h-full flex-col gap-2.5 rounded-none border-r border-border bg-card p-2 shadow-none'>
      <div className='relative flex items-center px-1 pt-1'>
        <Search className='pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-muted-foreground' />
        <Input
          placeholder='Search people...'
          aria-label='Search people'
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          className='w-full rounded-md bg-muted/40 py-1.5 pl-8 pr-8 text-xs transition-colors hover:bg-muted/60 focus-visible:bg-background'
        />
        {query && (
          <button
            type='button'
            onClick={() => changeQuery('')}
            aria-label='Clear search'
            className='absolute right-2.5 rounded p-1 text-muted-foreground transition-colors hover:text-foreground'
          >
            <LucideX className='h-3.5 w-3.5' />
          </button>
        )}
      </div>

      <ScrollArea className='w-full flex-1'>
        {renderBody()}
        <ScrollBar className='ml-1' />
      </ScrollArea>
    </Card>
  );
};

export default ConversationList;
