import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Users, ChevronRight, Play, Pause } from 'lucide-react';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ActiveGroupBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentGroup, currentSong, isPlaying, groupMembers, handlePlayPause } = useGroupMusic();

  if (!currentGroup || location.pathname.startsWith('/music/sync')) {
    return null;
  }

  const albumImage =
    currentSong?.image?.[1]?.link ||
    currentSong?.image?.[0]?.link ||
    'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className='fixed bottom-24 sm:bottom-20 right-4 sm:right-6 z-40 max-w-sm'
      >
        <div
          onClick={() => navigate('/music/sync')}
          className='liquid-panel-elevated p-2.5 rounded-2xl border border-primary/25 shadow-xl shadow-primary/5 flex items-center gap-3 cursor-pointer group hover:border-primary/50 transition-all'
        >
          {/* Thumbnail / Wave */}
          <div className='relative h-11 w-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/30'>
            <img src={albumImage} alt='' className='h-full w-full object-cover' />
            {isPlaying && (
              <div className='absolute inset-0 bg-black/40 flex items-center justify-center'>
                <div className='flex items-end gap-[2px] h-3'>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className='w-[2px] bg-white rounded-full animate-wave'
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        height: '100%',
                        transformOrigin: 'bottom',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Group details */}
          <div className='flex-1 min-w-0 pr-1'>
            <div className='flex items-center gap-1.5'>
              <span className='h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0' />
              <p className='text-[11px] font-bold tracking-tight text-primary uppercase truncate'>
                {currentGroup.name}
              </p>
            </div>
            <p className='text-xs font-semibold text-foreground truncate mt-0.5'>
              {currentSong?.name || 'Group listening session'}
            </p>
            <div className='flex items-center gap-1.5 mt-0.5'>
              <div className='flex -space-x-1 shrink-0'>
                {groupMembers.slice(0, 3).map((m) => (
                  <Avatar key={m.userId} className='h-3.5 w-3.5 ring-1 ring-background'>
                    <AvatarImage src={m.profilePic} />
                    <AvatarFallback className='text-[6px] bg-accent'>
                      {m.userName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className='text-[10px] text-muted-foreground/70'>
                {groupMembers.length} in room
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/music/sync');
            }}
            className='h-8 px-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors'
          >
            <span>Room</span>
            <ChevronRight className='h-3 w-3 group-hover:translate-x-0.5 transition-transform' />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default memo(ActiveGroupBar);
