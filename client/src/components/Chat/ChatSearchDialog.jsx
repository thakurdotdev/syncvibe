import { Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MIN_SEARCH_LENGTH, searchConversation } from '@/lib/chat';
import { previewOf } from '@/stores/chatStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

const SEARCH_DELAY_MS = 350;

const formatWhen = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

/** The searched words, in bold, wherever they come in the text. */
const Highlighted = ({ text, query }) => {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1 && needle; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className='bg-transparent font-semibold text-foreground'>
        {text.slice(at, at + needle.length)}
      </mark>
    );
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return parts;
};

/** Finds messages in this chat by their words or file names, and goes to the one clicked. */
const ChatSearchDialog = ({ open, onOpenChange, conversationId, meId, peerName, onPick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const term = normalize(query);
  const searching = term.length >= MIN_SEARCH_LENGTH;

  const changeQuery = (text) => {
    setQuery(text);
    const ready = normalize(text).length >= MIN_SEARCH_LENGTH;
    setLoading(ready);
    if (!ready) setResults(null);
  };

  useEffect(() => {
    if (!searching) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchConversation(conversationId, term, controller.signal)
        .then((messages) => {
          setResults(messages);
          setFailed(false);
        })
        .catch(() => !controller.signal.aborted && setFailed(true))
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, searching, conversationId]);

  const changeOpen = (next) => {
    if (!next) changeQuery('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className='gap-3 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Search this chat</DialogTitle>
          <DialogDescription>Find a message by its words, or a file by its name.</DialogDescription>
        </DialogHeader>

        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder={`Search your chat with ${peerName?.split(' ')[0] || 'them'}`}
            aria-label='Search this chat'
            className='pl-9 pr-9'
          />
          {loading && (
            <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground' />
          )}
        </div>

        <ScrollArea className='-mx-2 h-[min(440px,55vh)]'>
          <div className='space-y-0.5 px-2'>
            {searching &&
              results?.map((message) => (
                <button
                  key={message.id}
                  type='button'
                  onClick={() => {
                    changeQuery('');
                    onPick(message);
                  }}
                  className='block w-full cursor-pointer rounded-md px-3 py-2 text-left outline-none hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring'
                >
                  <span className='flex items-center justify-between gap-2'>
                    <span className='text-sm font-medium'>
                      {message.senderId === meId ? 'You' : peerName}
                    </span>
                    <span className='text-[11px] tabular-nums text-muted-foreground'>
                      {formatWhen(message.createdAt)}
                    </span>
                  </span>
                  <span className='line-clamp-3 text-sm text-muted-foreground'>
                    <Highlighted
                      text={message.body || message.attachment?.name || previewOf(message, null)}
                      query={term}
                    />
                  </span>
                </button>
              ))}
            {(!searching || (results?.length === 0 && !loading) || failed) && (
              <p className='px-2 py-10 text-center text-sm text-muted-foreground'>
                {!searching
                  ? `Type at least ${MIN_SEARCH_LENGTH} characters.`
                  : failed
                    ? "Couldn't search. Check your connection and try again."
                    : `Nothing in this chat matches "${term}"`}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChatSearchDialog;
