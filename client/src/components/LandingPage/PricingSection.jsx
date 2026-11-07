import { Check, Minus } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '../ui/button';

const ROWS = [
  ['Listeners in your room', '2', '10'],
  ['Songs in the room queue', '3', '50'],
  ['Synced playback', true, true],
  ['Reactions', true, true],
  ['Music streaming and playlists', true, true],
  ['Room chat, GIFs, and sound clips', false, true],
  ['Pro badge and priority support', false, true],
];

const cellLabel = (value) => {
  if (value === true) return 'Included';
  if (value === false) return 'Not included';
  return value;
};

const Value = ({ value }) => {
  if (value === true) return <Check size={17} className='inline-block' aria-hidden='true' />;
  if (value === false) {
    return <Minus size={17} className='inline-block text-muted-foreground/60' aria-hidden='true' />;
  }
  return (
    <span className='font-semibold tabular-nums' aria-hidden='true'>
      {value}
    </span>
  );
};

const PlanHead = ({ name, price, period }) => (
  <th scope='col' className='w-[24%] pb-5 text-left align-bottom font-normal sm:w-[22%]'>
    <span className='block text-sm text-muted-foreground'>{name}</span>
    <span className='font-display block text-3xl font-semibold tracking-tight sm:text-5xl'>
      {price}
    </span>
    <span className='block text-xs text-muted-foreground sm:text-sm'>{period}</span>
  </th>
);

const PricingSection = memo(() => (
  <section id='pricing' className='scroll-mt-24 py-14 sm:py-20'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <h2 className='section-title max-w-3xl'>Free to listen together. Pro for a bigger room.</h2>

      <div className='bezel mt-10 sm:mt-14'>
        <div className='bezel-inner px-4 pt-6 sm:px-8 sm:pt-8'>
          <table className='w-full border-collapse text-sm sm:text-base'>
            <caption className='sr-only'>Free and Pro plans compared</caption>
            <thead>
              <tr className='border-b border-border'>
                <th scope='col' className='pb-5'>
                  <span className='sr-only'>Feature</span>
                </th>
                <PlanHead name='Free' price='₹0' period='forever' />
                <PlanHead name='Pro' price='₹299' period='a year' />
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, free, pro]) => (
                <tr key={label} className='border-b border-border'>
                  <th scope='row' className='py-3.5 pr-3 text-left font-normal sm:py-4'>
                    {label}
                  </th>
                  <td className='py-3.5 sm:py-4' aria-label={cellLabel(free)}>
                    <Value value={free} />
                  </td>
                  <td className='py-3.5 sm:py-4' aria-label={cellLabel(pro)}>
                    <Value value={pro} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className='py-5 pr-3 text-xs text-muted-foreground sm:text-sm'>
                  Limits follow the person who creates the room. Friends can join on any plan.
                </td>
                <td className='py-5 pr-2'>
                  <Link
                    to='/register'
                    className={buttonVariants({ variant: 'outline', className: 'rounded-xl' })}
                  >
                    Start free
                  </Link>
                </td>
                <td className='py-5'>
                  <Link
                    to='/plans'
                    className={buttonVariants({ className: 'rounded-xl font-semibold' })}
                  >
                    Get Pro
                  </Link>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  </section>
));

PricingSection.displayName = 'PricingSection';
export default PricingSection;
