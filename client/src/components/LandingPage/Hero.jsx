import { motion } from 'framer-motion';
import { memo, useRef } from 'react';
import { TextBlurReveal } from '@/components/wensity/text-blur-reveal';
import CtaButtons from './CtaButtons';
import { LaptopRoom, PhoneRoom, SharedPlayhead, useDemoRoom } from './RoomDemo';

const HEADLINE_LINE =
  'flex-nowrap font-display font-bold tracking-[-0.03em] [font-variation-settings:"wdth"_100]';

const Hero = memo(() => {
  const stageRef = useRef(null);
  const room = useDemoRoom(stageRef);

  return (
    <section className='overflow-x-clip pt-24 sm:pt-28'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6'>
        <div className='grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_30rem] xl:items-end xl:gap-10'>
          <h1 className='text-[clamp(2.75rem,12.6vw,7rem)] leading-[0.92]'>
            <TextBlurReveal
              as='span'
              text='Same song.'
              delay={90}
              stepDuration={0.28}
              className={HEADLINE_LINE}
            />
            <TextBlurReveal
              as='span'
              text='Same second.'
              delay={90}
              startDelay={220}
              stepDuration={0.28}
              className={HEADLINE_LINE}
            />
          </h1>

          <div className='xl:pb-3'>
            <p className='max-w-xl text-base leading-relaxed text-muted-foreground'>
              Start a room and your friends hear exactly what you hear, wherever they are. Anyone
              can pause, skip, or add the next song.
            </p>
            <CtaButtons className='mt-5' />
          </div>
        </div>

        <motion.section
          ref={stageRef}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className='mt-10'
          aria-label='Interactive demo of a SyncVibe room on two devices'
        >
          <div className='grid grid-cols-2 items-end gap-3 md:grid-cols-[minmax(0,1fr)_11rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_15.5rem] lg:gap-10'>
            <LaptopRoom room={room} className='hidden md:block' />
            <PhoneRoom room={room} source='friend' className='md:hidden' />
            <PhoneRoom room={room} source='phone' />
          </div>
        </motion.section>
      </div>

      <div className='mt-8 sm:mt-10'>
        <SharedPlayhead room={room} />
        <p className='mx-auto mt-3 max-w-7xl px-4 text-sm text-muted-foreground sm:px-6'>
          Try it: press pause on either screen. This is a silent demo.
        </p>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';
export default Hero;
