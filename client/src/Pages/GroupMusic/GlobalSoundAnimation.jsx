import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2 } from 'lucide-react';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';

const GlobalSoundAnimation = ({ currentUserId }) => {
  const activeSoundEffect = useGroupSessionStore((s) => s.activeSoundEffect);
  const clearActiveSoundEffect = useGroupSessionStore((s) => s.clearActiveSoundEffect);

  useEffect(() => {
    if (!activeSoundEffect) return;
    const timer = setTimeout(() => {
      clearActiveSoundEffect();
    }, 3200);
    return () => clearTimeout(timer);
  }, [activeSoundEffect, clearActiveSoundEffect]);

  return (
    <AnimatePresence>
      {activeSoundEffect && (
        <motion.div
          key={activeSoundEffect.id || activeSoundEffect.timestamp}
          initial={{ opacity: 0, y: -20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className='fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none max-w-[90vw]'
        >
          <div className='flex items-center gap-2.5 px-3.5 py-1.5 rounded-full liquid-glass shadow-2xl border border-primary/30 backdrop-blur-xl'>
            {/* Sender Avatar or Speaker Icon */}
            {activeSoundEffect.profilePic ? (
              <Avatar className='h-6 w-6 ring-1 ring-primary/40 shadow-xs'>
                <AvatarImage src={activeSoundEffect.profilePic} />
                <AvatarFallback className='text-[9px] font-medium bg-primary/20 text-primary'>
                  {activeSoundEffect.userName?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className='h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center'>
                <Volume2 className='h-3.5 w-3.5' />
              </div>
            )}

            {/* Text details */}
            <div className='flex items-center gap-1.5 text-xs leading-none'>
              <span className='text-muted-foreground/80 font-medium'>
                {activeSoundEffect.senderId === currentUserId
                  ? 'You'
                  : activeSoundEffect.userName || 'Someone'}
              </span>
              <span className='text-muted-foreground/45'>played</span>
              <span className='font-semibold text-foreground truncate max-w-[160px]'>
                {activeSoundEffect.soundName}
              </span>
            </div>

            {/* Dynamic Equalizer Bouncing Bars */}
            <div className='flex items-center gap-[2px] h-3.5 pl-1' aria-hidden='true'>
              <span className='w-[2.5px] rounded-full bg-primary animate-sound-wave-1' />
              <span className='w-[2.5px] rounded-full bg-primary animate-sound-wave-2' />
              <span className='w-[2.5px] rounded-full bg-primary animate-sound-wave-3' />
              <span className='w-[2.5px] rounded-full bg-primary animate-sound-wave-4' />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(GlobalSoundAnimation);
