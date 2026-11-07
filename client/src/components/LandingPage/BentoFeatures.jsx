import { Clock3, ListMusic, QrCode, RadioTower, Video } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ART_STRIP, DEMO_PLAYLIST } from './demoSong';

const Tile = ({ title, description, className, children }) => (
  <article className={cn('bezel flex', className)}>
    <div className='bezel-inner flex w-full flex-col'>
      <div className='p-6 sm:p-8'>
        <h3 className='text-2xl font-semibold sm:text-3xl'>{title}</h3>
        <p className='mt-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base'>
          {description}
        </p>
      </div>
      <div className='mt-auto' aria-hidden='true'>
        {children}
      </div>
    </div>
  </article>
);

const ListenArt = () => (
  <div className='flex gap-3 overflow-hidden pb-6 pl-6 sm:pb-8 sm:pl-8'>
    {ART_STRIP.slice(0, 7).map((src) => (
      <img
        key={src}
        src={src}
        alt=''
        loading='lazy'
        className='h-32 w-32 shrink-0 rounded-xl bg-muted object-cover sm:h-44 sm:w-44'
      />
    ))}
  </div>
);

const MessagesArt = () => (
  <div className='mx-6 rounded-t-2xl border border-b-0 border-foreground/8 bg-background p-4 pb-5 sm:mx-8'>
    <div className='flex items-center gap-2.5 border-b border-border pb-3'>
      <span className='grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold'>
        M
      </span>
      <span className='flex-1 text-sm font-semibold'>Meera</span>
      <Video size={17} />
    </div>
    <div className='mt-3 space-y-2 text-[13px]'>
      <p className='w-fit rounded-2xl rounded-bl-md bg-muted px-3 py-2'>you up? new room</p>
      <p className='ml-auto w-fit rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground'>
        joining now
      </p>
    </div>
  </div>
);

const LibraryArt = () => (
  <ul className='mx-6 space-y-1 rounded-t-2xl border border-b-0 border-foreground/8 bg-background p-3 sm:mx-8'>
    {[
      [ListMusic, 'Late Night Fun', '2 songs'],
      [ListMusic, 'Dance', '5 songs'],
      [Clock3, 'History', 'Pick up where you left off'],
    ].map(([Icon, name, detail]) => (
      <li key={name} className='flex items-center gap-3 rounded-lg p-1.5'>
        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted'>
          <Icon size={15} />
        </span>
        <span className='min-w-0'>
          <span className='block truncate text-sm font-semibold'>{name}</span>
          <span className='block truncate text-xs text-muted-foreground'>{detail}</span>
        </span>
      </li>
    ))}
  </ul>
);

const RoomsArt = () => (
  <div className='flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:px-8 sm:pb-8'>
    <div className='flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-foreground/8 bg-background p-2.5 pr-4'>
      <img
        src={DEMO_PLAYLIST[1].cover}
        alt=''
        loading='lazy'
        className='h-12 w-12 rounded-xl bg-muted object-cover'
      />
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>Back to Fun Sunday</span>
        <span className='block truncate text-xs text-muted-foreground'>2 listening now</span>
      </span>
      <RadioTower size={17} />
    </div>
    <div className='flex items-center gap-3 rounded-2xl border border-foreground/8 bg-background p-2.5 pr-4'>
      <span className='grid h-12 w-12 place-items-center rounded-xl bg-muted'>
        <QrCode size={20} />
      </span>
      <span className='text-sm font-semibold'>Scan to join</span>
    </div>
  </div>
);

const BentoFeatures = memo(() => (
  <section id='features' className='scroll-mt-24 py-14 sm:py-20'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <h2 className='section-title max-w-3xl'>A full music app, even when you listen alone.</h2>

      <div className='mt-10 grid gap-4 lg:grid-cols-6'>
        <Tile
          title='Listen'
          description='Trending songs, charts, new albums, and quick picks based on what you play.'
          className='lg:col-span-4'
        >
          <ListenArt />
        </Tile>
        <Tile
          title='Messages'
          description='Talk to friends one to one, and start a video call from the chat.'
          className='lg:col-span-2'
        >
          <MessagesArt />
        </Tile>
        <Tile
          title='Library'
          description='Your playlists and listening history, on every device.'
          className='lg:col-span-2'
        >
          <LibraryArt />
        </Tile>
        <Tile
          title='Rooms'
          description='Rejoin the room you were in, or scan a friend’s QR code to join theirs.'
          className='lg:col-span-4'
        >
          <RoomsArt />
        </Tile>
      </div>
    </div>
  </section>
));

BentoFeatures.displayName = 'BentoFeatures';
export default BentoFeatures;
