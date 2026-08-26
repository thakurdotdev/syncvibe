import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '../ui/button';

const PricingSection = memo(() => {
  return (
    <section id='pricing' className='py-20 px-4 sm:px-6 relative border-t border-zinc-800/60'>
      <div className='max-w-4xl mx-auto'>
        <div className='text-center max-w-md mx-auto mb-14 space-y-2.5'>
          <span className='text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest'>
            Plans
          </span>
          <h2 className='text-2xl sm:text-4xl font-bold text-white tracking-tight'>
            Simple, honest pricing.
          </h2>
          <p className='text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal'>
            Start for free. Upgrade when you want larger sync rooms and video channels.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto'>
          {/* Starter Plan */}
          <div className='rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl p-6 sm:p-7 flex flex-col justify-between hover:border-zinc-700 transition-colors'>
            <div className='space-y-4'>
              <div>
                <h3 className='text-base font-bold text-white'>Starter</h3>
                <p className='text-xs text-zinc-400'>Essential sync for 2 listeners</p>
              </div>

              <div className='flex items-baseline gap-1'>
                <span className='text-3xl font-extrabold text-white tracking-tight'>₹0</span>
                <span className='text-xs text-zinc-500'>/ forever</span>
              </div>

              <ul className='space-y-2.5 pt-2'>
                {[
                  'Full music library streaming',
                  'Personal & public playlists',
                  'Up to 2 listeners in sync room',
                  '3 queued songs in room',
                  'Social stories & posts feed',
                ].map((feature, i) => (
                  <li key={i} className='flex items-center gap-2 text-xs text-zinc-300'>
                    <Check size={13} className='text-zinc-500 shrink-0' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='pt-6'>
              <Link to='/register'>
                <Button
                  variant='outline'
                  className='w-full h-10 rounded-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer'
                >
                  Start for Free
                </Button>
              </Link>
            </div>
          </div>

          {/* PRO Plan */}
          <div className='relative rounded-2xl border border-zinc-700 bg-zinc-900/80 backdrop-blur-xl p-6 sm:p-7 flex flex-col justify-between shadow-2xl'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-base font-bold text-white'>PRO</h3>
                  <p className='text-xs text-zinc-400'>For active squads and communities</p>
                </div>
                <span className='px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-bold font-mono'>
                  POPULAR
                </span>
              </div>

              <div className='flex items-baseline gap-1'>
                <span className='text-3xl font-extrabold text-white tracking-tight'>₹299</span>
                <span className='text-xs text-zinc-500'>/ year</span>
              </div>

              <ul className='space-y-2.5 pt-2'>
                {[
                  'Everything in Starter plan',
                  'Up to 10 listeners in sync room',
                  'Up to 50 queued songs in room',
                  'Video & voice room channels',
                  'Live room chat & reactions',
                  'PRO badge on profile',
                ].map((feature, i) => (
                  <li key={i} className='flex items-center gap-2 text-xs text-white'>
                    <Check size={13} className='text-white shrink-0' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='pt-6'>
              <Link to='/plans'>
                <Button className='w-full h-10 rounded-full bg-white text-black hover:bg-zinc-200 font-semibold text-xs cursor-pointer shadow-sm'>
                  <span>Upgrade to PRO</span>
                  <ArrowRight className='ml-1.5 h-3.5 w-3.5' />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

PricingSection.displayName = 'PricingSection';
export default PricingSection;
