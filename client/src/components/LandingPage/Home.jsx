import { MotionConfig } from 'framer-motion';
import { memo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ArtStrip from './ArtStrip';
import BentoFeatures from './BentoFeatures';
import CtaButtons from './CtaButtons';
import { DEMO_PLAYLIST } from './demoSong';
import FAQ from './FAQ';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import MobileShowcase from './MobileShowcase';
import PricingSection from './PricingSection';
import WebShowcase from './WebShowcase';

const FinalCTA = memo(() => (
  <section className='mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28'>
    <div className='bezel'>
      <div className='bezel-inner px-5 py-12 sm:px-12 sm:py-20'>
        <img
          src={DEMO_PLAYLIST[0].cover}
          alt=''
          aria-hidden='true'
          loading='lazy'
          className='absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-20 blur-3xl'
        />
        <h2 className='text-[clamp(2.1rem,8.5vw,6rem)] leading-[1] font-semibold tracking-[-0.04em] [font-variation-settings:"wdth"_100]'>
          <span className='block'>Pick a song.</span>
          <span className='block'>Call your friends.</span>
        </h2>
        <CtaButtons className='mt-8' />
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
        <ArtStrip />
        <HowItWorks />
        <WebShowcase />
        <BentoFeatures />
        <MobileShowcase />
        <PricingSection />
        <FAQ />
        <FinalCTA />
      </div>
    </MotionConfig>
  );
};

export default memo(Home);
