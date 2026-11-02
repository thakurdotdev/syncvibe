import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const NEAR_BOTTOM_PX = 80;

/**
 * Chat scroll behaviour used by messaging apps:
 * - starts at the latest message
 * - follows new messages only while the reader is already at the bottom
 *   (or when they sent the message themselves)
 * - otherwise counts unseen messages so the UI can offer a "jump to latest" pill
 * - stays pinned while content grows (GIFs loading, composer resizing)
 */
export const useStickToBottom = ({ itemCount, lastItemIsOwn }) => {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const previousCountRef = useRef(itemCount);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const updateAtBottom = useCallback((value) => {
    isAtBottomRef.current = value;
    setIsAtBottom(value);
    if (value) setUnseenCount(0);
  }, []);

  const scrollToBottom = useCallback(
    (behavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      updateAtBottom(true);
    },
    [updateAtBottom]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    if (nearBottom !== isAtBottomRef.current) updateAtBottom(nearBottom);
  }, [updateAtBottom]);

  useLayoutEffect(() => {
    scrollToBottom('instant');
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    const added = itemCount - previousCountRef.current;
    previousCountRef.current = itemCount;
    if (added <= 0) return;

    if (isAtBottomRef.current || lastItemIsOwn) {
      scrollToBottom(added > 3 ? 'instant' : 'smooth');
    } else {
      setUnseenCount((count) => count + added);
    }
  }, [itemCount, lastItemIsOwn, scrollToBottom]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    observer.observe(scrollEl);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  return { scrollRef, contentRef, isAtBottom, unseenCount, handleScroll, scrollToBottom };
};
