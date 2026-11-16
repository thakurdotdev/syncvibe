import { Check } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonVariants } from '../ui/button';

// Keep in step with planFeatures in Pages/Plans/index.jsx and the plans in the database.
const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    cta: ['Start free', '/register'],
    features: [
      'Rooms with 2 listeners',
      '3 songs in the room queue',
      'Synced playback and reactions',
      'Music streaming and playlists',
    ],
  },
  {
    name: 'Pro',
    price: '₹299',
    period: 'a year',
    cta: ['Get Pro', '/plans'],
    featured: true,
    features: [
      'Rooms with up to 10 listeners',
      'Up to 50 songs in the room queue',
      'Room chat, GIFs and sound clips',
      'Pro badge and priority support',
    ],
  },
];

const Plan = ({ name, price, period, cta: [label, to], features, featured }) => (
  <article className='bezel flex'>
    <div className='bezel-inner flex w-full flex-col p-6 sm:p-8'>
      <div className='flex items-baseline justify-between gap-4'>
        <h3 className='text-lg font-semibold'>{name}</h3>
        {featured && (
          <span className='rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-0.5 text-xs font-medium'>
            For bigger rooms
          </span>
        )}
      </div>
      <p className='mt-6 flex items-baseline gap-2'>
        <span className='font-display text-5xl font-bold tracking-[-0.03em] sm:text-6xl'>
          {price}
        </span>
        <span className='text-sm text-muted-foreground'>{period}</span>
      </p>
      <ul className='mt-8 mb-10 space-y-3 border-t border-border pt-6 text-sm sm:text-base'>
        {features.map((feature) => (
          <li key={feature} className='flex gap-3'>
            <Check size={18} className='mt-0.5 shrink-0' aria-hidden='true' />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className={cn(
          buttonVariants({
            size: 'lg',
            variant: featured ? 'default' : 'outline',
            className: 'mt-auto w-full rounded-xl font-semibold',
          })
        )}
      >
        {label}
      </Link>
    </div>
  </article>
);

const PricingSection = memo(() => (
  <section id='pricing' className='scroll-mt-24 py-16 sm:py-24'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <div className='grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16'>
        <div>
          <h2 className='section-title'>Free to listen together.</h2>
          <p className='mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg'>
            Pro is for bigger rooms. Limits follow the person who creates the room, so friends can
            join on any plan.
          </p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {PLANS.map((plan) => (
            <Plan key={plan.name} {...plan} />
          ))}
        </div>
      </div>
    </div>
  </section>
));

PricingSection.displayName = 'PricingSection';
export default PricingSection;
