import { useSyncExternalStore } from 'react';
import { useUiStore } from '@/stores/uiStore';

const subscribers = new Map();
const subscribe = (query) => {
  if (!subscribers.has(query)) {
    subscribers.set(query, (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    });
  }
  return subscribers.get(query);
};

const useMatch = (query) =>
  useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false
  );

/**
 * Responsive shell modes:
 *  - < 768px: no sidebar, bottom tab bar
 *  - 768–1279px: icon rail only
 *  - ≥ 1280px: full sidebar unless the user collapsed it
 */
export const useShellLayout = () => {
  const hasSidebar = useMatch('(min-width: 768px)');
  const canExpand = useMatch('(min-width: 1280px)');
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const isExpanded = hasSidebar && canExpand && !collapsed;
  return { hasSidebar, canExpand, isExpanded, isMobile: !hasSidebar };
};
