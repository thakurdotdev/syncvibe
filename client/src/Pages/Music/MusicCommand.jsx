import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';
import SearchDialog from './SearchDialog';
import './music.css';

/**
 * Mounts the global music search palette once and binds ⌘K / Ctrl+K.
 * Open it from anywhere with `useUiStore.getState().setSearchOpen(true)`.
 */
const MusicCommand = () => {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const toggle = useUiStore((s) => s.toggleSearch);
  const { pathname } = useLocation();

  // Navigating from a result (album, artist, playlist) should land on the page, not behind the palette.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return <SearchDialog open={open} setOpen={setOpen} />;
};

export default MusicCommand;
