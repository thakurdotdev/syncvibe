import { motion } from 'framer-motion';
import { PhoneOff, Video } from 'lucide-react';
import { acceptCall, endCall } from '@/lib/call';
import { EASE_OUT } from '@/lib/motion';
import { CallAvatar } from './CallParts';

/** Someone is calling: who, and the two things to do about it. */
const IncomingCall = ({ person }) => (
  <motion.div
    role='alertdialog'
    aria-label={`Incoming video call from ${person?.name}`}
    initial={{ opacity: 0, y: -16, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
    exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14, ease: EASE_OUT } }}
    className='fixed inset-x-3 top-3 z-[60] sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[360px]'
  >
    <div className='rounded-3xl border border-border bg-popover/90 p-4 text-popover-foreground shadow-[0_24px_60px_-20px_hsl(var(--scrim)/0.55)] backdrop-blur-xl'>
      <div className='flex items-center gap-3.5'>
        <div className='relative shrink-0'>
          <span className='absolute inset-0 animate-ping rounded-full bg-foreground/20 [animation-duration:1.6s]' />
          <CallAvatar
            person={person}
            className='relative h-14 w-14 border-border'
            textClassName='bg-muted text-lg text-foreground'
          />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-base font-semibold leading-tight'>{person?.name}</p>
          <p className='mt-1 flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Video className='h-3.5 w-3.5' />
            Incoming video call
          </p>
        </div>
      </div>

      <div className='mt-4 flex gap-2'>
        <button
          type='button'
          onClick={endCall}
          className='press flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90'
        >
          <PhoneOff className='h-4 w-4 shrink-0' />
          Decline
        </button>
        <button
          type='button'
          onClick={acceptCall}
          className='press flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90'
        >
          <Video className='h-4 w-4 shrink-0' />
          Accept
        </button>
      </div>
    </div>
  </motion.div>
);

export default IncomingCall;
