import { memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// Memoized Message Component
const ChatMessage = memo(({ msg, isOwn }) => (
  <div className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
    {!isOwn && (
      <Avatar className='h-8 w-8 shrink-0'>
        <AvatarImage src={msg.profilePic} />
        <AvatarFallback className='text-xs'>
          {msg.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )}

    <div
      className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5',
        isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-accent rounded-bl-md'
      )}
    >
      {!isOwn && <p className='text-xs font-medium mb-1 opacity-70'>{msg.userName}</p>}
      <p className='text-sm break-words'>{msg.message}</p>
    </div>

    {isOwn && (
      <Avatar className='h-8 w-8 shrink-0'>
        <AvatarImage src={msg.profilePic} />
        <AvatarFallback className='text-xs'>
          {msg.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )}
  </div>
));

// Memoized Empty State
const EmptyState = memo(() => (
  <div className='h-full flex flex-col items-center justify-center text-center p-4'>
    <MessageCircle className='h-8 w-8 md:h-12 md:w-12 text-muted-foreground/30 mb-2' />
    <p className='text-muted-foreground text-xs md:text-sm'>No messages yet</p>
  </div>
));

// Memoized Messages List
const MessagesList = memo(({ messages, currentUserId }) => {
  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className='space-y-3'>
      {messages.map((msg, i) => (
        <ChatMessage key={msg.id || i} msg={msg} isOwn={msg.senderId === currentUserId} />
      ))}
    </div>
  );
});

// Main GroupChat Component
const GroupChat = ({ messages, currentUserId, onSendMessage }) => {
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const message = inputRef.current?.value?.trim();
    if (message) {
      onSendMessage(message);
      inputRef.current.value = '';
    }
  }, [onSendMessage]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Memoize message count
  const messageCount = useMemo(() => messages.length, [messages.length]);

  return (
    <Card className='h-full flex flex-col border-border/50 shadow-lg overflow-hidden'>
      <CardHeader className='py-2 md:pb-3 px-3 md:px-6 border-b border-border/50'>
        <CardTitle className='text-sm md:text-lg flex items-center gap-2'>
          <div className='p-1 md:p-1.5 rounded-full bg-primary/10'>
            <MessageCircle className='h-3 w-3 md:h-4 md:w-4 text-primary' />
          </div>
          Chat
          {messageCount > 0 && (
            <span className='text-xs font-normal text-muted-foreground'>({messageCount})</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 flex flex-col p-0 min-h-0'>
        <ScrollArea ref={scrollRef} className='flex-1 p-2 md:p-4' style={{ height: '350px' }}>
          <MessagesList messages={messages} currentUserId={currentUserId} />
        </ScrollArea>

        <div className='p-2 md:p-3 border-t border-border/50 bg-accent/30'>
          <div className='flex gap-2'>
            <Input
              ref={inputRef}
              placeholder='Type a message...'
              onKeyPress={handleKeyPress}
              className='rounded-full bg-background border-border/50 h-9 md:h-10 text-sm'
            />
            <Button
              onClick={handleSend}
              size='icon'
              className='rounded-full shrink-0 h-9 w-9 md:h-10 md:w-10'
            >
              <Send className='h-3.5 w-3.5 md:h-4 md:w-4' />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(GroupChat);
