import { memo } from 'react';

const STEPS = [
  {
    title: 'Start a room',
    description:
      'Give it a name and pick a song, or turn the song you are already playing into a room.',
  },
  {
    title: 'Bring your friends',
    description:
      'Invite friends who are online, send the room code, or let them scan it. A browser is enough to join.',
  },
  {
    title: 'Listen together',
    description:
      'Every player follows the room. Pause, skip or add the next song, and react when the chorus hits.',
  },
];

const HowItWorks = memo(() => (
  <section id='how-it-works' className='scroll-mt-24 py-16 sm:py-24'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <h2 className='section-title'>
        <span className='block'>Three steps to</span>
        <span className='block'>the same song.</span>
      </h2>
      <ol className='mt-10 grid gap-px overflow-hidden rounded-3xl border border-foreground/8 bg-foreground/8 sm:mt-14 md:grid-cols-3'>
        {STEPS.map(({ title, description }, n) => (
          <li key={title} className='flex flex-col bg-background p-6 sm:p-8'>
            <span
              className='font-display text-5xl font-bold tracking-tight text-foreground/15 tabular-nums sm:text-6xl'
              aria-hidden='true'
            >
              {String(n + 1).padStart(2, '0')}
            </span>
            <h3 className='mt-8 text-xl font-semibold sm:mt-12 sm:text-2xl'>{title}</h3>
            <p className='mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base'>
              {description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </section>
));

HowItWorks.displayName = 'HowItWorks';
export default HowItWorks;
