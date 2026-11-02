import { motion } from 'framer-motion';
import { memo } from 'react';

const ReconnectingView = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className='flex h-full flex-col items-center justify-center gap-5'
    role='status'
  >
    <div className='h-12 w-12 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary' />
    <div className='space-y-1 text-center'>
      <p className='text-sm font-semibold'>Reconnecting to your room</p>
      <p className='text-xs text-muted-foreground'>Syncing playback with everyone…</p>
    </div>
  </motion.div>
);

export default memo(ReconnectingView);
