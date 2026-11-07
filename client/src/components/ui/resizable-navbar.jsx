// Adapted from Aceternity UI's resizable-navbar: theme tokens, lucide icons, framer-motion.
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Children, cloneElement, isValidElement, useState } from 'react';
import { cn } from '@/lib/utils';

const SPRING = { type: 'spring', stiffness: 200, damping: 50 };
// Near-solid, because the bar passes over the inverted Android section and glass turns unreadable.
const SOLID_PILL = 'border-border bg-background/95 shadow-lg shadow-scrim/10 backdrop-blur-xl';

export const Navbar = ({ children, className }) => {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => setVisible(latest > 80));

  return (
    <div className={cn('fixed inset-x-0 top-0 z-50 w-full', className)}>
      {Children.map(children, (child) =>
        isValidElement(child) ? cloneElement(child, { visible }) : child
      )}
    </div>
  );
};

export const NavBody = ({ children, className, visible }) => (
  <motion.div
    animate={{ width: visible ? '62%' : '100%', y: visible ? 12 : 0 }}
    transition={SPRING}
    style={{ minWidth: '860px' }}
    className={cn(
      'relative mx-auto hidden max-w-7xl flex-row items-center justify-between rounded-full border border-transparent px-6 py-3 transition-colors duration-200 lg:flex',
      visible && SOLID_PILL + ' py-2 pl-3 pr-2',
      className
    )}
  >
    {children}
  </motion.div>
);

export const NavItems = ({ items, className }) => (
  <div
    className={cn(
      'pointer-events-none absolute inset-0 flex flex-row items-center justify-center gap-1 text-sm font-medium',
      className
    )}
  >
    {items.map((item) => (
      <a
        key={item.link}
        href={item.link}
        className='pointer-events-auto rounded-full px-4 py-2 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground'
      >
        {item.name}
      </a>
    ))}
  </div>
);

export const MobileNav = ({ children, className, visible }) => (
  <motion.div
    animate={{ y: visible ? 8 : 0 }}
    transition={SPRING}
    className={cn(
      'relative mx-auto flex w-[calc(100%-1rem)] flex-col rounded-2xl border border-transparent px-2 py-2 transition-colors duration-200 lg:hidden',
      visible && SOLID_PILL,
      className
    )}
  >
    {children}
  </motion.div>
);

export const MobileNavHeader = ({ children, className }) => (
  <div className={cn('flex w-full flex-row items-center justify-between', className)}>
    {children}
  </div>
);

export const MobileNavMenu = ({ children, className, isOpen }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16 }}
        className={cn(
          'absolute inset-x-0 top-full mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-lg',
          className
        )}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export const MobileNavToggle = ({ isOpen, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    aria-expanded={isOpen}
    aria-label={isOpen ? 'Close menu' : 'Open menu'}
    className='press grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground hover:bg-accent'
  >
    {isOpen ? <X size={18} /> : <Menu size={18} />}
  </button>
);
