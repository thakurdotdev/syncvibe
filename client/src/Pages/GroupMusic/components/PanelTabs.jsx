import { cn } from '@/lib/utils';
import { memo, useCallback, useRef } from 'react';

const Badge = ({ value, tone }) => {
  if (!value) return null;
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
        tone === 'alert'
          ? 'bg-primary text-primary-foreground'
          : 'bg-foreground/10 text-muted-foreground'
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
};

/**
 * Accessible segmented tab bar (WAI-ARIA tabs pattern with arrow-key navigation).
 *
 * tabs: [{ value, label, icon?: LucideIcon, count?: number, alert?: number }]
 * `count` renders a neutral badge, `alert` an attention badge (e.g. unread messages).
 */
const PanelTabs = ({ tabs, value, onChange, idPrefix, className, fill = false }) => {
  const listRef = useRef(null);
  const hasSelection = tabs.some((tab) => tab.value === value);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const index = Math.max(
        0,
        tabs.findIndex((tab) => tab.value === value)
      );
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      onChange(next.value);
      listRef.current?.querySelector(`#${idPrefix}-tab-${next.value}`)?.focus();
    },
    [tabs, value, onChange, idPrefix]
  );

  return (
    <div
      ref={listRef}
      role='tablist'
      onKeyDown={handleKeyDown}
      className={cn('flex items-center gap-1 rounded-xl bg-foreground/[0.04] p-1', className)}
    >
      {tabs.map(({ value: tabValue, label, icon: Icon, count, alert }, index) => {
        const selected = tabValue === value;
        // Keep the tablist reachable by keyboard even when no tab is selected (e.g. while searching).
        const focusable = selected || (!hasSelection && index === 0);
        return (
          <button
            key={tabValue}
            id={`${idPrefix}-tab-${tabValue}`}
            type='button'
            role='tab'
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tabValue}`}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange(tabValue)}
            className={cn(
              'flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              fill && 'flex-1',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className='h-3.5 w-3.5' aria-hidden='true' />}
            <span>{label}</span>
            {alert ? <Badge value={alert} tone='alert' /> : <Badge value={count} />}
          </button>
        );
      })}
    </div>
  );
};

/** Wraps the content for a tab; stays mounted so scroll position and drafts survive switching. */
export const TabPanel = ({ idPrefix, value, active, className, children }) => (
  <div
    id={`${idPrefix}-panel-${value}`}
    role='tabpanel'
    aria-labelledby={`${idPrefix}-tab-${value}`}
    hidden={!active}
    className={cn('min-h-0 flex-1 flex-col', active ? 'flex' : 'hidden', className)}
  >
    {children}
  </div>
);

export default memo(PanelTabs);
