import he from 'he';
import { Check, Hourglass, X } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

const IconButton = ({ label, onClick, tone, children }) => (
  <button
    type='button'
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cn(
      'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      tone === 'primary'
        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
        : 'bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
    )}
  >
    {children}
  </button>
);

/**
 * Songs waiting for a host's OK (when the room asks for that). The hosts see everyone's and let
 * them in or turn them away; a listener sees only their own and can take one back.
 */
const SongRequests = ({ requests, myId, canManage, onAnswer }) => {
  const shown = canManage
    ? requests
    : requests.filter((r) => myId != null && String(r.requestedBy?.userId) === myId);
  if (shown.length === 0) return null;

  return (
    <section aria-label='Songs waiting for approval' className='mb-2 px-1'>
      <div className='flex items-center gap-1.5 px-1.5 pb-1.5 text-xs font-medium text-muted-foreground'>
        <Hourglass className='h-3.5 w-3.5' aria-hidden='true' />
        {canManage ? 'Waiting for your OK' : 'Waiting for the hosts'}
        <span className='tabular-nums'>· {shown.length}</span>
      </div>
      <ul className='space-y-1 rounded-2xl bg-foreground/[0.03] p-1.5 ring-1 ring-border/40'>
        {shown.map((request) => {
          const name = he.decode(request.song?.name || 'Song');
          const mine = myId != null && String(request.requestedBy?.userId) === myId;
          return (
            <li key={request.id} className='flex items-center gap-2.5 rounded-xl p-1.5'>
              <img
                src={request.song?.image?.[1]?.link}
                alt=''
                className='h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border/30'
                loading='lazy'
              />
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{name}</p>
                <p className='truncate text-xs text-muted-foreground/80'>
                  {mine ? 'You asked' : `${request.requestedBy?.userName || 'Someone'} asked`}
                  {request.next ? ' · to play next' : ''}
                </p>
              </div>
              {canManage ? (
                <div className='flex items-center gap-1.5'>
                  <IconButton
                    label={`Turn away ${name}`}
                    onClick={() => onAnswer(request.id, false)}
                  >
                    <X className='h-4 w-4' />
                  </IconButton>
                  <IconButton
                    label={`Add ${name}`}
                    tone='primary'
                    onClick={() => onAnswer(request.id, true)}
                  >
                    <Check className='h-4 w-4' />
                  </IconButton>
                </div>
              ) : (
                <IconButton label={`Take back ${name}`} onClick={() => onAnswer(request.id, false)}>
                  <X className='h-4 w-4' />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default memo(SongRequests);
