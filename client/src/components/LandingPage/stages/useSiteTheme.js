import { useSyncExternalStore } from 'react';

// Stages take their theme as a prop; the site's ThemeProvider sets a class on <html>.
const subscribe = (onChange) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

const isDark = () => document.documentElement.classList.contains('dark');

export const useSiteTheme = () =>
  useSyncExternalStore(subscribe, isDark, () => false) ? 'dark' : 'light';
