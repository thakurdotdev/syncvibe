import { Download } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

const POINTS = [
  ['Plays with the screen off', 'Keep the room going with your phone in your pocket.'],
  ['Controls in your notifications', 'Pause or skip without opening the app.'],
  ['Room invites as alerts', 'Know the moment a friend asks you to join.'],
  ['Updates itself', 'New versions install from inside the app.'],
];

const Screen = ({ src, alt, className }) => (
  <img
    src={src}
    alt={alt}
    width={720}
    height={1508}
    loading='lazy'
    className={`rounded-[2rem] border-[5px] border-foreground/10 shadow-2xl shadow-scrim/40 ${className}`}
  />
);

const MobileShowcase = memo(() => (
  <section id='android' className='scroll-mt-24 py-14 sm:py-20'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <div className='bezel'>
        <div className='bezel-inner grid items-center gap-10 p-6 pb-0 sm:p-10 sm:pb-0 lg:grid-cols-2 lg:gap-12 lg:p-0 lg:pl-14'>
          <div className='lg:py-16'>
            <h2 className='section-title'>The room fits in your pocket.</h2>
            <dl className='mt-8 grid gap-5 sm:grid-cols-2'>
              {POINTS.map(([title, description]) => (
                <div key={title}>
                  <dt className='font-semibold'>{title}</dt>
                  <dd className='mt-1 text-sm leading-relaxed text-muted-foreground'>
                    {description}
                  </dd>
                </div>
              ))}
            </dl>
            <div className='mt-9 flex flex-wrap items-center gap-x-5 gap-y-3'>
              <Button asChild size='lg' className='rounded-xl px-6 font-semibold'>
                <Link to='/download'>
                  <Download className='mr-2 h-4 w-4' />
                  Download for Android
                </Link>
              </Button>
              <p className='text-sm text-muted-foreground'>On iPhone, join from your browser.</p>
            </div>
          </div>

          <div className='relative mx-auto h-[24rem] w-full max-w-md self-stretch sm:h-[32rem] lg:h-auto lg:min-h-[40rem] lg:max-w-none'>
            <Screen
              src='/landing/room-dark.webp'
              alt='A SyncVibe room in dark mode, with the song playing above the room chat'
              className='absolute top-0 left-[4%] w-[54%] lg:top-12 lg:w-[50%]'
            />
            <Screen
              src='/landing/room-light.webp'
              alt='The same SyncVibe room in light mode'
              className='absolute top-14 right-[4%] w-[54%] lg:top-28 lg:right-[8%] lg:w-[50%]'
            />
          </div>
        </div>
      </div>
    </div>
  </section>
));

MobileShowcase.displayName = 'MobileShowcase';
export default MobileShowcase;
