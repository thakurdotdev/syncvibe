import { useEffect } from 'react';
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
