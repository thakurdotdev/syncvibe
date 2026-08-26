import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, X } from 'lucide-react';

const INVITE_DURATION_SEC = 60;

const InviteNotification = ({ invite, onAccept, onDecline }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!invite) return;

    timerRef.current = setTimeout(() => {
      onDecline(invite);
    }, INVITE_DURATION_SEC * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [invite, onDecline]);

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className='fixed bottom-5 right-5 z-50 w-[340px] max-w-[calc(100vw-2rem)] select-none'
        >
          <div className='relative rounded-2xl overflow-hidden backdrop-blur-2xl border border-white/[0.12] dark:border-white/[0.08] bg-background/90 shadow-2xl shadow-black/40'>
            {/* Smooth Top Progress Countdown Bar */}
            <div className='absolute top-0 left-0 right-0 h-[2px] bg-muted/40 overflow-hidden'>
              <motion.div
                className='h-full bg-primary'
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: INVITE_DURATION_SEC, ease: 'linear' }}
              />
            </div>

            <div className='p-3.5 pt-4 flex items-center gap-3'>
              {/* Inviter Avatar with Live Ping */}
              <div className='relative shrink-0'>
                <Avatar className='h-10 w-10 ring-1 ring-border/30 shadow-sm'>
                  <AvatarImage src={invite.inviterPic} className='object-cover' />
                  <AvatarFallback className='bg-primary/15 text-primary text-xs font-semibold'>
                    {invite.inviterName?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className='absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background' />
              </div>

              {/* Text Info */}
              <div className='flex-1 min-w-0'>
                <p className='text-xs font-semibold text-foreground truncate leading-tight'>
                  {invite.inviterName}
                </p>
                <div className='flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground truncate'>
                  <span>Invited you to</span>
                  <span className='font-medium text-foreground truncate flex items-center gap-1'>
                    <Users className='h-2.5 w-2.5 text-primary shrink-0 inline' />
                    {invite.groupName}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className='flex items-center gap-1.5 shrink-0'>
                <button
                  type='button'
                  onClick={() => onAccept(invite)}
                  className='h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 flex items-center justify-center'
                >
                  Join
                </button>
                <button
                  type='button'
                  onClick={() => onDecline(invite)}
                  title='Dismiss invite'
                  className='h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 active:scale-90 transition-all cursor-pointer border-0'
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(InviteNotification);
