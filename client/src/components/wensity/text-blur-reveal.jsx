// Adapted from Wensity UI's text-blur-reveal: word mode only, and it plays once on mount.
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function TextBlurReveal({
  text = '',
  delay = 200,
  startDelay = 0,
  className,
  stepDuration = 0.35,
  as: Tag = 'p',
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <Tag className={cn('flex flex-wrap', className)}>{text}</Tag>;
  }

  const words = text.split(' ');

  return (
    <Tag className={cn('flex flex-wrap', className)}>
      <span className='sr-only'>{text}</span>
      {words.map((word, index) => (
        <motion.span
          key={`${index}-${word}`}
          className='inline-block'
          aria-hidden='true'
          initial={{ filter: 'blur(10px)', opacity: 0, y: -50 }}
          animate={{
            filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
            opacity: [0, 0.5, 1],
            y: [-50, 5, 0],
          }}
          transition={{
            duration: Math.max(0.1, stepDuration * 2),
            times: [0, 0.5, 1],
            delay: (startDelay + index * delay) / 1000,
            ease: 'easeOut',
          }}
        >
          {word}
          {index < words.length - 1 ? ' ' : null}
        </motion.span>
      ))}
    </Tag>
  );
}
