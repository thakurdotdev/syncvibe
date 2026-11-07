import { memo } from 'react';
import { InfiniteMarquee } from '@/components/wensity/infinite-marquee';
import { ART_STRIP } from './demoSong';

const hideBroken = (event) => {
  event.currentTarget.style.visibility = 'hidden';
};

const ArtStrip = memo(() => (
  <section className='pt-16 pb-6 sm:pt-20 sm:pb-10' aria-hidden='true'>
    <InfiniteMarquee
      speed={80}
      gap='gap-3'
      fade={false}
      pauseOnHover
      items={ART_STRIP.map((src) => (
        <div
          className='h-40 w-40 overflow-hidden rounded-2xl border border-foreground/10 bg-muted sm:h-56 sm:w-56'
          key={src}
        >
          <img
            src={src}
            alt=''
            width={224}
            height={224}
            loading='lazy'
            onError={hideBroken}
            className='h-full w-full object-cover'
          />
        </div>
      ))}
    />
  </section>
));

ArtStrip.displayName = 'ArtStrip';
export default ArtStrip;
