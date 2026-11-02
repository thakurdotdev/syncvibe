import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useState } from 'react';

const FloatingReaction = memo(({ id, emoji, onDone }) => {
  // Randomised once per reaction so each one drifts along its own path.
  const [path] = useState(() => ({
    left: Math.random() * 70 + 15,
    drift: (Math.random() - 0.5) * 30,
    scale: 0.9 + Math.random() * 0.5,
    duration: 1.6 + Math.random() * 0.4,
  }));

  return (
    <motion.span
      initial={{ opacity: 1, y: 0, scale: 0.3 }}
      animate={{
        opacity: [1, 1, 0],
        y: -110,
        x: path.drift,
        scale: [0.3, path.scale, path.scale * 0.7],
      }}
      transition={{ duration: path.duration, ease: 'easeOut' }}
      onAnimationComplete={() => onDone(id)}
      className='absolute bottom-4 select-none text-2xl drop-shadow-lg'
      style={{ left: `${path.left}%` }}
    >
      {emoji}
    </motion.span>
  );
});

/** Overlay that renders reactions sent by anyone in the room. */
const FloatingReactions = () => {
  const reactions = useGroupSessionStore((s) => s.floatingReactions);

  const removeReaction = useCallback((id) => {
    useGroupSessionStore.setState((s) => ({
      floatingReactions: s.floatingReactions.filter((r) => r.id !== id),
    }));
  }, []);

  return (
    <div className='pointer-events-none absolute inset-0 z-20 overflow-hidden' aria-hidden='true'>
      <AnimatePresence>
        {reactions.map((r) => (
          <FloatingReaction key={r.id} id={r.id} emoji={r.emoji} onDone={removeReaction} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default memo(FloatingReactions);
