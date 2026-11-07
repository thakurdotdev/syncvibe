// Started from Aceternity UI's sticky-scroll-reveal. It follows the page's scroll instead of an
// inner scrolling box, which would trap the wheel. On large screens the whole scene stays pinned
// while the steps play through; on phones the steps stack, each with its own stage.
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const StepMarker = ({ index, active }) => (
  <span
    className={cn(
      'absolute top-0 left-0 grid h-8 w-8 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-200',
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border bg-background text-muted-foreground'
    )}
  >
    {index + 1}
  </span>
);

export const StickyScroll = ({ heading, steps, renderStage }) => {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setActive(Math.min(Math.floor(latest * steps.length), steps.length - 1));
  });

  const jumpTo = (index) => {
    const node = ref.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY;
    const travel = node.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * ((index + 0.1) / steps.length) });
  };

  return (
    <>
      <div className='lg:hidden'>
        {heading}
        <ol className='mt-10 space-y-12'>
          {steps.map((step, index) => (
            <li key={step.title}>
              <div className='relative pl-11'>
                <StepMarker index={index} active />
                <h3 className='text-3xl font-bold'>{step.title}</h3>
                <p className='mt-2 text-base leading-relaxed text-muted-foreground'>
                  {step.description}
                </p>
              </div>
              <div className='mt-5 h-[26rem]'>{renderStage(index)}</div>
            </li>
          ))}
        </ol>
      </div>

      <div ref={ref} className='hidden h-[300vh] lg:block'>
        <div className='sticky top-0 grid h-screen grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 pt-16'>
          <div>
            {heading}
            <ol className='relative mt-10'>
              <span
                className='absolute top-2 bottom-2 left-[15px] w-0.5 bg-border'
                aria-hidden='true'
              >
                <motion.span
                  className='block h-full origin-top bg-foreground'
                  style={{ scaleY: scrollYProgress }}
                />
              </span>
              {steps.map((step, index) => (
                <li key={step.title} className='relative pb-6 last:pb-0'>
                  <button
                    type='button'
                    onClick={() => jumpTo(index)}
                    aria-current={active === index ? 'step' : undefined}
                    className='relative block w-full cursor-pointer pl-12 text-left'
                  >
                    <StepMarker index={index} active={active >= index} />
                    <span
                      className={cn(
                        'font-display block text-3xl font-semibold transition-colors duration-200 xl:text-4xl',
                        active === index ? 'text-foreground' : 'text-muted-foreground/70'
                      )}
                    >
                      {step.title}
                    </span>
                  </button>
                  {/* A CSS transition, not Framer Motion: animating height to 'auto' makes it measure the
                      page and call window.scrollTo, which cancels smooth scrolling and stops the
                      nav links partway down the page. */}
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                      active === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <p className='min-h-0 max-w-md overflow-hidden pl-12 text-base leading-relaxed text-muted-foreground'>
                      <span className='block pt-2'>{step.description}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className='h-[min(38rem,calc(100vh-8rem))]'>{renderStage(active)}</div>
        </div>
      </div>
    </>
  );
};
