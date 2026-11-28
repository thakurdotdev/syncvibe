import { ArrowDown, Loader2, MessageSquareDashed } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { loadUntil } from '@/lib/chat';
import { messageStatus, useChatStore } from '@/stores/chatStore';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import CallMessageBubble from './CallMessageBubble';
import { dayKey } from './ChatDateUtils';
import DateSeparator from './DateSeparator';
import MessageBubble from './MessageBubble';

const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_WITHIN_PX = 160;
/** Messages from one person this close together read as one run. */
const RUN_GAP_MS = 5 * 60 * 1000;
/** With this many unread, the chat opens at the first of them instead of at the latest. */
const OPEN_AT_UNREAD_FROM = 6;
const HIGHLIGHT_MS = 1600;

/** Where the unread messages start: a line across the conversation. */
const UnreadLine = ({ count, lineRef }) => (
  <div ref={lineRef} className='my-4 flex items-center gap-3'>
    <span className='h-px flex-1 bg-border' />
    <span className='text-xs font-semibold text-muted-foreground'>
      {count === 1 ? '1 unread message' : `${count} unread messages`}
    </span>
    <span className='h-px flex-1 bg-border' />
  </div>
);

const ThreadSkeleton = () => (
  <div className='flex-1 space-y-5 overflow-hidden p-4'>
    <div className='my-2 flex justify-center'>
      <Skeleton className='h-5 w-24 rounded-full' />
    </div>
    <Skeleton className='h-11 w-52 rounded-2xl rounded-bl-sm' />
    <Skeleton className='ml-auto h-14 w-64 rounded-2xl rounded-br-sm bg-primary/20' />
    <Skeleton className='h-20 w-60 rounded-2xl rounded-bl-sm' />
    <Skeleton className='ml-auto h-9 w-36 rounded-2xl rounded-br-sm bg-primary/20' />
    <Skeleton className='h-10 w-44 rounded-2xl rounded-bl-sm' />
  </div>
);

const Notice = ({ title, children }) => (
  <div className='flex flex-1 flex-col items-center justify-center p-6'>
    <div className='flex max-w-sm flex-col items-center gap-4 text-center'>
      <div className='rounded-full bg-muted/60 p-4 text-muted-foreground ring-8 ring-muted/20'>
        <MessageSquareDashed className='h-8 w-8' />
      </div>
      <div className='space-y-1.5'>
        <h3 className='text-lg font-semibold text-foreground'>{title}</h3>
        {children}
      </div>
    </div>
  </div>
);

const MessageList = ({ conversation, thread, meId, actions, onLoadOlder, onRetryLoad }) => {
  const { messages, status, hasMore, loadingOlder } = thread;
  const starred = useChatStore((s) => s.starred);
  const jump = useChatStore((s) => s.jump);

  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const atBottomRef = useRef(true);
  /** The list as it was after the last render, to tell older messages arriving from new ones. */
  const seenRef = useRef({ first: null, last: null, height: 0, top: 0 });
  const [unseen, setUnseen] = useState(0);
  const [openMenuFor, setOpenMenuFor] = useState(null);
  const [selectedFor, setSelectedFor] = useState(null);
  const unreadLineRef = useRef(null);

  // Where the unread messages started when the chat was opened. Taken once, before the read
  // receipt moves it, so the line stays put while the chat is open.
  const [unreadAtOpen, setUnreadAtOpen] = useState(null);
  if (status === 'ready' && unreadAtOpen === null) {
    const readUpTo = conversation.myLastReadMessageId;
    const first = messages.find((m) => m.id != null && m.id > readUpTo && m.senderId !== meId);
    setUnreadAtOpen({
      firstId: first?.id ?? null,
      count: first ? Math.max(conversation.unreadCount, 1) : 0,
    });
  }

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    atBottomRef.current = true;
    setUnseen(0);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    if (atBottomRef.current) setUnseen(0);
    seenRef.current.top = el.scrollTop;
    if (el.scrollTop <= LOAD_OLDER_WITHIN_PX && hasMore && !loadingOlder) onLoadOlder();
  };

  const isEmpty = messages.length === 0;
  const first = messages[0]?.clientId ?? null;
  const last = messages.at(-1)?.clientId ?? null;
  const lastIsOwn = messages.at(-1)?.senderId === meId;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const seen = seenRef.current;

    if (seen.last == null) {
      // A lot unread: start at the first of them, the line at the top.
      const line = unreadLineRef.current;
      if (line && (unreadAtOpen?.count ?? 0) >= OPEN_AT_UNREAD_FROM) {
        el.scrollTop = line.offsetTop - 8;
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
      } else {
        scrollToBottom('instant');
      }
    } else if (first !== seen.first && last === seen.last) {
      // Older messages were added above: stay on the message the reader was looking at.
      el.scrollTop = seen.top + (el.scrollHeight - seen.height);
    } else if (last !== seen.last) {
      if (atBottomRef.current || lastIsOwn) scrollToBottom('smooth');
      else setUnseen((count) => count + 1);
    }

    seenRef.current = { first, last, height: el.scrollHeight, top: el.scrollTop };
  }, [first, last, lastIsOwn, scrollToBottom, status, unreadAtOpen]);

  // Photos change the height as they load; keep the latest message in view while they do.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
      seenRef.current.height = el.scrollHeight;
    });
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [status, isEmpty]);

  // Older pages load until the message is there, then it scrolls into view, tinted a moment.
  const jumpTo = useCallback(
    async (messageId) => {
      if (!(await loadUntil(conversation.id, messageId))) {
        toast("That message isn't in this chat anymore");
        return;
      }
      requestAnimationFrame(() => {
        const target = document.getElementById(`message-${messageId}`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('bg-primary/10');
        setTimeout(() => target.classList.remove('bg-primary/10'), HIGHLIGHT_MS);
      });
    },
    [conversation.id]
  );

  // Sent here from Starred or a search: go to that message once the chat has loaded.
  useEffect(() => {
    if (!jump || jump.conversationId !== conversation.id || status !== 'ready') return;
    useChatStore.getState().clearJump();
    void jumpTo(jump.messageId);
  }, [jump, conversation.id, status, jumpTo]);

  const rows = useMemo(() => {
    const sameRun = (a, b) =>
      Boolean(a && b) &&
      a.type !== 'call' &&
      b.type !== 'call' &&
      a.senderId === b.senderId &&
      dayKey(a.createdAt) === dayKey(b.createdAt) &&
      Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < RUN_GAP_MS;

    return messages.map((message, index) => {
      const before = messages[index - 1];
      return {
        message,
        newDay: !before || dayKey(before.createdAt) !== dayKey(message.createdAt),
        startsRun: !sameRun(before, message),
        endsRun: !sameRun(message, messages[index + 1]),
      };
    });
  }, [messages]);

  if (status === 'loading' || status === 'idle') return <ThreadSkeleton />;

  if (status === 'error') {
    return (
      <Notice title="Couldn't load messages">
        <Button variant='outline' size='sm' onClick={onRetryLoad}>
          Try again
        </Button>
      </Notice>
    );
  }

  if (isEmpty) {
    return (
      <Notice title='No messages yet'>
        <p className='text-xs leading-relaxed text-muted-foreground'>
          Say hello to <span className='font-medium text-foreground'>{conversation.peer.name}</span>
          .
        </p>
      </Notice>
    );
  }

  return (
    <div className='relative min-h-0 flex-1'>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className='h-full overflow-y-auto overscroll-contain px-4 pb-2'
      >
        <div ref={contentRef}>
          <div className='flex h-10 items-center justify-center text-xs text-muted-foreground'>
            {loadingOlder ? (
              <Loader2 className='h-4 w-4 animate-spin' aria-label='Loading older messages' />
            ) : hasMore ? null : (
              <span>This is the start of your conversation</span>
            )}
          </div>

          {rows.map(({ message, newDay, startsRun, endsRun }) => (
            <div key={message.clientId}>
              {newDay && <DateSeparator date={message.createdAt} />}
              {unreadAtOpen?.firstId != null && message.id === unreadAtOpen.firstId && (
                <UnreadLine count={unreadAtOpen.count} lineRef={unreadLineRef} />
              )}
              {message.type === 'call' ? (
                <CallMessageBubble message={message} isOwnMessage={message.senderId === meId} />
              ) : (
                <MessageBubble
                  message={message}
                  isOwn={message.senderId === meId}
                  meId={meId}
                  peerName={conversation.peer.name}
                  status={message.senderId === meId ? messageStatus(message, conversation) : null}
                  startsRun={startsRun}
                  endsRun={endsRun}
                  menuOpen={openMenuFor === message.clientId}
                  selected={selectedFor === message.clientId}
                  onSelect={() =>
                    setSelectedFor((current) =>
                      current === message.clientId ? null : message.clientId
                    )
                  }
                  onMenuOpenChange={(open) => setOpenMenuFor(open ? message.clientId : null)}
                  actions={actions}
                  onJump={jumpTo}
                  starred={message.id != null && Boolean(starred[message.id])}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {unseen > 0 && (
        <Button
          size='sm'
          onClick={() => scrollToBottom()}
          className='absolute bottom-3 left-1/2 h-8 -translate-x-1/2 gap-1.5 rounded-full px-3 text-xs shadow-lg'
        >
          <ArrowDown className='h-3.5 w-3.5' />
          {unseen} new {unseen === 1 ? 'message' : 'messages'}
        </Button>
      )}
    </div>
  );
};

export default MessageList;
