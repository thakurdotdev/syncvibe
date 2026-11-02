import { Loader2, Search, X } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';

const QueueSearchField = ({ value, isLoading, focusRequest, onChange, onClear }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusRequest) inputRef.current?.focus();
  }, [focusRequest]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault();
      onClear();
    }
  };

  return (
    <div className='relative'>
      <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60' />
      <input
        ref={inputRef}
        type='search'
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder='Search songs to add…'
        aria-label='Search songs to add to the queue'
        className='h-10 w-full rounded-xl border border-border/40 bg-background/60 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border [&::-webkit-search-cancel-button]:hidden'
      />
      <div className='absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center'>
        {isLoading ? (
          <Loader2
            className='mr-1.5 h-4 w-4 animate-spin text-muted-foreground'
            aria-label='Searching'
          />
        ) : (
          value && (
            <button
              type='button'
              onClick={onClear}
              aria-label='Clear search'
              className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default memo(QueueSearchField);
