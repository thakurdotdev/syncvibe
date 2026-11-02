import { useEffect, useRef } from 'react';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
// Space already activates these, so don't hijack it.
const SPACE_OWNERS = 'button, a, [role="slider"], [role="tab"], [role="switch"], [role="checkbox"]';
const OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"]';

const isEditable = (el) => Boolean(el && (el.isContentEditable || EDITABLE_TAGS.has(el.tagName)));

/**
 * Room-wide keyboard shortcuts:
 *  Space → play / pause
 *  /     → focus the chat composer
 */
export const useRoomShortcuts = ({ onTogglePlay, onFocusChat }) => {
  const handlersRef = useRef({ onTogglePlay, onFocusChat });

  useEffect(() => {
    handlersRef.current = { onTogglePlay, onFocusChat };
  }, [onTogglePlay, onFocusChat]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target;
      if (isEditable(target) || document.querySelector(OVERLAYS)) return;

      if (event.code === 'Space') {
        if (target instanceof Element && target.closest(SPACE_OWNERS)) return;
        event.preventDefault();
        handlersRef.current.onTogglePlay?.();
      } else if (event.key === '/') {
        event.preventDefault();
        handlersRef.current.onFocusChat?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
