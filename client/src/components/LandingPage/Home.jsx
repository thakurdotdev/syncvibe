import { memo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import Hero from './Hero';
import BentoFeatures from './BentoFeatures';
import HowItWorks from './HowItWorks';
import MobileShowcase from './MobileShowcase';
import PricingSection from './PricingSection';

const FAQ = lazy(() => import('./FAQ'));

const FinalCTA = memo(() => (
  <section className='py-20 px-4 sm:px-6 relative border-t border-zinc-800/60 overflow-hidden'>
    <div className='max-w-3xl mx-auto text-center relative z-10 space-y-5'>
      <h2 className='text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight'>
        Ready to listen in sync?
      </h2>

      <p className='text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed font-normal'>
        Create a room, invite your friends, and start streaming together in seconds.
      </p>

      <div className='flex flex-col sm:flex-row items-center justify-center gap-3 pt-2'>
        <Link to='/register'>
          <Button
            size='lg'
            className='h-11 px-7 rounded-full bg-white text-black hover:bg-zinc-200 font-semibold text-xs cursor-pointer shadow-sm transition-all active:scale-98'
          >
            <span>Get Started Free</span>
            <ArrowRight className='ml-2 h-3.5 w-3.5' />
          </Button>
        </Link>
        <Link to='/login'>
          <Button
            size='lg'
            variant='outline'
            className='h-11 px-6 rounded-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs cursor-pointer transition-all'
          >
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  </section>
));

FinalCTA.displayName = 'FinalCTA';

const Home = () => {
  return (
    <div className='min-h-screen bg-[#050505] text-white selection:bg-white/20 selection:text-white overflow-x-hidden'>
      <Hero />
      <BentoFeatures />
      <HowItWorks />
      <MobileShowcase />
      <PricingSection />
      <Suspense
        fallback={
          <div className='h-24 flex items-center justify-center'>
            <Loader2 className='w-5 h-5 animate-spin text-zinc-600' />
          </div>
        }
      >
        <FAQ />
      </Suspense>
      <FinalCTA />
    </div>
  );
};

export default memo(Home);
