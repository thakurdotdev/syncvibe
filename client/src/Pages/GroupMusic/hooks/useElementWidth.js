import { useLayoutEffect, useState } from 'react';

/**
 * Tracks an element's width with ResizeObserver.
 * Layout decisions use the room's own width rather than the viewport,
 * because the app sidebar can take a large share of the screen.
 *
 * Returns [callbackRef, width].
 */
export const useElementWidth = () => {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!node) return undefined;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
};
