import { motion } from 'framer-motion';
import { memo } from 'react';
import CtaButtons from './CtaButtons';
import HeroStage from './stages/HeroStage';

const rise = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.25, 0.8, 0.25, 1] },
});

const Hero = memo(() => (
  <section className='overflow-x-clip pt-28 sm:pt-32'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-12'>
        <motion.h1
          {...rise(0)}
          className='font-display text-[clamp(2.6rem,10.5vw,6.5rem)] leading-[0.94] font-bold tracking-[-0.035em] [font-variation-settings:"wdth"_100]'
        >
          <span className='block'>Press play.</span>
          <span className='block text-muted-foreground'>Everyone hears it.</span>
        </motion.h1>

        <motion.div {...rise(0.12)} className='lg:pb-2'>
          <p className='max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg'>
            Start a room and your friends hear the same song at the same second, on a phone or in a
            browser. Skip, add the next song, or react, and every screen follows.
          </p>
          <CtaButtons className='mt-6' />
        </motion.div>
      </div>
    </div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
      className='mx-auto mt-10 max-w-7xl px-4 sm:mt-14 sm:px-6'
    >
      <p className='sr-only'>
        A SyncVibe room open on a laptop and a phone. Next is pressed on the laptop, and the phone
        changes to the same song at the same moment.
      </p>
      <div aria-hidden='true'>
        <HeroStage />
      </div>
    </motion.div>
    <div className='hairline-glow' />
  </section>
));

Hero.displayName = 'Hero';
export default Hero;
