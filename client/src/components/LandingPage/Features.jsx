import { MessageCircle, Video } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ART_STRIP } from './demoSong';
import { JoinStage, QueueStage, RolesStage } from './stages/FeatureStages';

// One picture made of tiles: one hero (the queue), a number, an object, a component, a
// statement and a wall of covers. Copy sits above each picture, run-in style.

const Tile = ({ lead, rest, className, children }) => (
  <article className={cn('bezel flex', className)}>
    <div className='bezel-inner flex w-full flex-col'>
      {lead && (
        <p className='max-w-md px-6 pt-6 text-lg leading-snug text-muted-foreground sm:px-8 sm:pt-8 sm:text-xl'>
          <strong className='font-semibold text-foreground'>{lead}</strong> {rest}
        </p>
      )}
      {children}
    </div>
  </article>
);

const Picture = ({ children }) => (
  <div className='mt-6 flex-1' aria-hidden='true'>
    {children}
  </div>
);

// Ten seats: a free room fills two of them, a Pro room all ten.
const StatTile = () => (
  <article className='bezel flex'>
    <div className='bezel-inner flex w-full flex-col justify-between gap-8 p-6 sm:p-8'>
      <p className='text-lg leading-snug text-muted-foreground sm:text-xl'>
        <strong className='font-semibold text-foreground'>Room for everyone.</strong> Free rooms
        take two listeners.
      </p>
      <div className='grid w-fit grid-cols-5 gap-2.5' aria-hidden='true'>
        {Array.from({ length: 10 }, (_, n) => (
          <span
            key={n}
            className={cn(
              'h-9 w-9 rounded-full sm:h-10 sm:w-10',
              n < 2 ? 'bg-foreground' : 'border border-foreground/15 bg-foreground/5'
            )}
          />
        ))}
      </div>
      <div>
        <p className='font-display text-[5.5rem] leading-[0.9] font-bold tracking-[-0.04em] whitespace-nowrap tabular-nums sm:text-[7rem]'>
          10
        </p>
        <p className='mt-2 text-sm font-medium text-muted-foreground'>
          listeners and 50 songs in a Pro room
        </p>
      </div>
    </div>
  </article>
);

const TalkTile = () => (
  <article className='bezel flex'>
    <div className='bezel-inner flex w-full flex-col justify-between gap-10 p-6 sm:p-8'>
      <div className='flex gap-2' aria-hidden='true'>
        <span className='grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-background'>
          <MessageCircle size={20} />
        </span>
        <span className='grid h-12 w-12 place-items-center rounded-2xl border border-foreground/10 bg-foreground/5'>
          <Video size={20} />
        </span>
      </div>
      <p className='font-display text-3xl leading-[1.08] font-semibold tracking-[-0.025em] sm:text-4xl'>
        <span className='block'>Message a friend.</span>
        <span className='block text-muted-foreground'>Call them on video from the web.</span>
      </p>
    </div>
  </article>
);

const hideBroken = (event) => {
  event.currentTarget.style.visibility = 'hidden';
};

const LibraryTile = () => (
  <article className='bezel lg:col-span-3'>
    <div className='bezel-inner grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'>
      <p className='max-w-md self-center px-6 pt-6 text-lg leading-snug text-muted-foreground sm:px-8 sm:pt-8 sm:text-xl lg:py-12 lg:pr-0'>
        <strong className='font-semibold text-foreground'>Plenty to play on your own.</strong>{' '}
        Trending songs, charts, new albums and your playlists, with your history on every device.
      </p>
      <div
        className='mt-6 grid h-56 grid-cols-[repeat(6,8.5rem)] gap-3 overflow-hidden pl-6 [mask-image:linear-gradient(to_right,#000_80%,transparent)] sm:pl-8 lg:mt-0 lg:h-72 lg:grid-cols-[repeat(6,9rem)] lg:pt-8 lg:pl-0'
        aria-hidden='true'
      >
        {ART_STRIP.map((src, n) => (
          <img
            key={src}
            src={src}
            alt=''
            width={144}
            height={144}
            loading='lazy'
            onError={hideBroken}
            className={cn(
              'aspect-square w-full rounded-2xl border border-foreground/8 bg-muted object-cover',
              n % 2 === 1 && 'translate-y-8'
            )}
          />
        ))}
      </div>
    </div>
  </article>
);

const Features = memo(() => (
  <section id='features' className='scroll-mt-24 py-16 sm:py-24'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <h2 className='section-title max-w-3xl'>Everything a room needs.</h2>

      <div className='mt-10 grid gap-4 sm:mt-14 lg:grid-cols-3'>
        <Tile
          lead='A queue everyone adds to.'
          rest='Drag songs into order. When it runs dry, Autoplay picks the next one.'
          className='lg:col-span-2'
        >
          <Picture>
            <QueueStage />
          </Picture>
        </Tile>
        <StatTile />

        <Tile lead='Join with a code.' rest='Or scan it from the host’s screen.'>
          <Picture>
            <JoinStage />
          </Picture>
        </Tile>
        <Tile lead='Share the controls.' rest='Make a friend co-host, or keep it open to everyone.'>
          <Picture>
            <RolesStage />
          </Picture>
        </Tile>
        <TalkTile />

        <LibraryTile />
      </div>
    </div>
  </section>
));

Features.displayName = 'Features';
export default Features;
