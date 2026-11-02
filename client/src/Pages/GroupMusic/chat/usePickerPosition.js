import { useLayoutEffect, useState } from 'react';

const VIEWPORT_MARGIN = 8;
const GAP_ABOVE_ANCHOR = 8;
const MIN_HEIGHT = 260;

/**
 * Positions a popover picker above its anchor (the chat composer) so it always fits:
 * - width: at least `minWidth` even when the chat rail is narrow (extends left over the
 *   room instead of squeezing), at most `maxWidth`, never wider than the viewport
 * - height: `preferredHeight`, reduced to the space available above the anchor
 * - recomputed on window resize and when the anchor changes size
 *
 * Returns `{ bottom, left, width, height }` for a `position: fixed` element, or null.
 */
export const usePickerPosition = (
  anchorRef,
  { minWidth = 320, maxWidth = 440, preferredHeight = 460 } = {}
) => {
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return undefined;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const availableWidth = viewportWidth - VIEWPORT_MARGIN * 2;

      const width = Math.min(availableWidth, maxWidth, Math.max(rect.width, minWidth));
      // Right-align with the anchor (the chat rail sits on the right), then keep on screen.
      const preferredLeft = rect.right - width;
      const left = Math.min(
        Math.max(preferredLeft, VIEWPORT_MARGIN),
        viewportWidth - width - VIEWPORT_MARGIN
      );

      const spaceAbove = rect.top - GAP_ABOVE_ANCHOR - VIEWPORT_MARGIN;
      const height = Math.max(
        Math.min(preferredHeight, spaceAbove),
        Math.min(MIN_HEIGHT, spaceAbove)
      );

      setPosition({
        bottom: window.innerHeight - rect.top + GAP_ABOVE_ANCHOR,
        left,
        width,
        height,
      });
    };

    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(anchor);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [anchorRef, minWidth, maxWidth, preferredHeight]);

  return position;
};
