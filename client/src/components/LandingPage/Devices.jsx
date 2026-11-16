import { Download } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

const POINTS = [
  ['Plays with the screen off', 'Keep the room going with your phone in your pocket.'],
  ['Controls in your notifications', 'Pause or skip without opening the app.'],
  ['Invites as alerts', 'Know the moment a friend asks you to join.'],
  ['Play here', 'See which of your devices is playing, and bring the music to this one.'],
];

// Real screenshots of the same room: the web app leads, the phone straddles its right edge.
const Devices = memo(() => (
  <section id='android' className='scroll-mt-24 py-16 sm:py-24'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16'>
        <h2 className='section-title'>One room on every screen you own.</h2>
        <p className='max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:pb-2'>
          Open the room in a browser on your laptop, and take it with you on Android. On an iPhone,
          join from the browser.
        </p>
      </div>

      <div className='relative mt-10 pr-[18%] sm:mt-14 lg:pr-[22%]'>
        <div className='bezel'>
          <div className='bezel-inner'>
            <img
              src='/landing/room-web-light.webp'
              alt='A SyncVibe room on the web, with the song playing, the queue and the room chat side by side'
              width={1913}
              height={1015}
              loading='lazy'
              className='h-auto w-full dark:hidden'
            />
            <img
              src='/landing/room-web-dark.webp'
              alt='A SyncVibe room on the web, with the song playing, the queue and the room chat side by side'
              width={1913}
              height={1015}
              loading='lazy'
              className='hidden h-auto w-full dark:block'
            />
          </div>
        </div>
        <div className='absolute top-[14%] right-0 w-[30%] max-w-[18rem] lg:w-[26%]'>
          <img
            src='/landing/room-light.webp'
            alt='The same room in the Android app'
            width={720}
            height={1508}
            loading='lazy'
            className='h-auto w-full rounded-[1.6rem] border-[5px] border-foreground/10 bg-background shadow-2xl shadow-scrim/40 sm:rounded-[2.2rem] sm:border-[6px] dark:hidden'
          />
          <img
            src='/landing/room-dark.webp'
            alt='The same room in the Android app'
            width={720}
            height={1508}
            loading='lazy'
            className='hidden h-auto w-full rounded-[1.6rem] border-[5px] border-foreground/10 bg-background shadow-2xl shadow-scrim/40 sm:rounded-[2.2rem] sm:border-[6px] dark:block'
          />
        </div>
      </div>

      <dl className='mt-24 grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:mt-28 sm:grid-cols-2 lg:mt-36 lg:grid-cols-4'>
        {POINTS.map(([title, description]) => (
          <div key={title}>
            <dt className='font-semibold'>{title}</dt>
            <dd className='mt-1 text-sm leading-relaxed text-muted-foreground'>{description}</dd>
          </div>
        ))}
      </dl>

      <div className='mt-8 flex flex-wrap items-center gap-x-5 gap-y-3'>
        <Button asChild size='lg' className='rounded-xl px-6 font-semibold'>
          <Link to='/download'>
            <Download className='mr-2 h-4 w-4' />
            Download for Android
          </Link>
        </Button>
        <p className='text-sm text-muted-foreground'>
          No iPhone app yet. On an iPhone, join from the browser.
        </p>
      </div>
    </div>
  </section>
));

Devices.displayName = 'Devices';
export default Devices;
