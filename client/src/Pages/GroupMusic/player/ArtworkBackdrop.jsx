import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';

/** Blurred, tinted copy of the current artwork used as a panel background. */
const ArtworkBackdrop = ({ imageUrl, intensity = 0.35 }) => (
  <div className='pointer-events-none absolute inset-0 overflow-hidden' aria-hidden='true'>
    <AnimatePresence initial={false}>
      {imageUrl && (
        <motion.div
          key={imageUrl}
          initial={{ opacity: 0 }}
          animate={{ opacity: intensity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className='absolute inset-0 scale-125 bg-cover bg-center blur-3xl saturate-150'
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
    </AnimatePresence>
    <div className='absolute inset-0 bg-gradient-to-br from-background/30 via-background/60 to-background/90' />
  </div>
);

export default memo(ArtworkBackdrop);
