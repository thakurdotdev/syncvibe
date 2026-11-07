import { memo } from 'react';

const Shot = ({ src, className }) => (
  <img
    src={src}
    alt='A SyncVibe room on the web, with the song playing, the Up next queue, and the room chat side by side'
    width={1913}
    height={1015}
    loading='lazy'
    className={className}
  />
);

const WebShowcase = memo(() => (
  <section id='web' className='scroll-mt-24 py-14 sm:py-20'>
    <div className='mx-auto max-w-7xl px-4 sm:px-6'>
      <div className='grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-16'>
        <h2 className='section-title'>On a big screen, see the whole room.</h2>
        <p className='max-w-xl text-base leading-relaxed text-muted-foreground lg:pb-2'>
          The song, the queue, and the chat sit side by side. Drag songs to reorder them, let
          Autoplay keep the music going, and react to any message.
        </p>
      </div>
      <div className='bezel mt-8 sm:mt-12'>
        <div className='bezel-inner'>
          <Shot src='/landing/room-web-light.webp' className='h-auto w-full dark:hidden' />
          <Shot src='/landing/room-web-dark.webp' className='hidden h-auto w-full dark:block' />
        </div>
      </div>
    </div>
  </section>
));

WebShowcase.displayName = 'WebShowcase';
export default WebShowcase;
