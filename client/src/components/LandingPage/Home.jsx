import { MotionConfig } from 'framer-motion';
import { memo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CtaButtons from './CtaButtons';
import { ART_STRIP } from './demoSong';
import Devices from './Devices';
import FAQ from './FAQ';
import Features from './Features';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import PricingSection from './PricingSection';

const FinalCTA = memo(() => (
  <section className='mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28'>
    <div className='bezel'>
      <div className='bezel-inner grid items-center gap-10 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto]'>
        <div>
          <h2 className='font-display text-[clamp(2.4rem,7vw,5.25rem)] leading-[0.98] font-bold tracking-[-0.04em] [font-variation-settings:"wdth"_100]'>
            <span className='block'>Pick a song.</span>
            <span className='block text-muted-foreground'>Call your friends.</span>
          </h2>
          <CtaButtons className='mt-8' />
        </div>
        <div className='hidden grid-cols-3 gap-3 lg:grid' aria-hidden='true'>
          {ART_STRIP.slice(0, 6).map((src, n) => (
            <img
              key={src}
              src={src}
              alt=''
              width={112}
              height={112}
              loading='lazy'
              className={`h-28 w-28 rounded-2xl border border-foreground/8 bg-muted object-cover ${n % 3 === 1 ? '-translate-y-4' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  </section>
));

FinalCTA.displayName = 'FinalCTA';

const Home = () => {
  const { hash } = useLocation();

  // The page is lazy-loaded, so a link like /#pricing arrives before its section exists.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <MotionConfig reducedMotion='user'>
      <div className='min-h-screen overflow-x-clip bg-background text-foreground'>
        <Hero />
        <HowItWorks />
        <Features />
        <Devices />
        <PricingSection />
        <FAQ />
        <FinalCTA />
      </div>
    </MotionConfig>
  );
};

export default memo(Home);
