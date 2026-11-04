import React from 'react';

import { cn } from '@/lib/utils';

export function RainbowButton({ children, className, ...props }) {
  return (
    <button
      className={cn(
        'group relative inline-flex h-11 animate-rainbow cursor-pointer items-center justify-center rounded-xl border-0 bg-size-[200%] px-8 py-2 font-medium text-primary-foreground transition-colors [background-clip:padding-box,border-box,border-box] bg-origin-border [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        // before styles
        'before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))] before:filter-[blur(calc(0.8*1rem))]',
        // fill: inverse of the page, with the rainbow border showing at the edge
        'bg-[linear-gradient(hsl(var(--primary)),hsl(var(--primary))),linear-gradient(hsl(var(--primary))_50%,hsl(var(--primary)/0.6)_80%,transparent),linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
