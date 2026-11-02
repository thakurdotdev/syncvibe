import { cn } from '@/lib/utils';

/**
 * Base surface for every region of the room. Panels never grow the page:
 * they fill the space their parent gives them and scroll internally.
 */
export const Panel = ({ as: Component = 'section', className, children, ...props }) => (
  <Component
    className={cn(
      'liquid-panel relative flex min-h-0 flex-col overflow-hidden rounded-2xl',
      className
    )}
    {...props}
  >
    {children}
  </Component>
);

export const PanelHeader = ({ className, children }) => (
  <div className={cn('shrink-0 border-b border-border/15 px-3 py-2.5', className)}>{children}</div>
);

/** The only scrollable part of a panel. */
export const PanelBody = ({ className, children, ...props }) => (
  <div
    className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain chat-scroll-area', className)}
    {...props}
  >
    {children}
  </div>
);
