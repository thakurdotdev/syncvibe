/* oxlint-disable jsx-a11y/media-has-caption, jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions -- videos are people's own and have no captions; clicking the backdrop or the photo is a pointer shortcut, and Escape and the buttons are the keyboard way */
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const control =
  'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-scrim/45 text-on-scrim backdrop-blur-md transition-colors hover:bg-scrim/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-scrim/60';

/**
 * The conversation's photos and videos, full screen. Arrow keys and swipes move between them,
 * Escape closes. `items` are `{ key, kind, url, downloadUrl, name }`.
 */
const MediaViewer = ({ items, initialIndex = 0, onClose, onDownload }) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const touchStart = useRef(null);
  const closeRef = useRef(null);
  const item = items[Math.min(index, items.length - 1)];
  const many = items.length > 1;

  const go = useCallback(
    (step) => {
      if (!many) return;
      setIndex((current) => (current + step + items.length) % items.length);
      setZoomed(false);
      setLoaded(false);
    },
    [items.length, many]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Escape') {
        if (zoomed) setZoomed(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, zoomed]);

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // The photos either side are fetched ahead, so moving to them is instant.
  useEffect(() => {
    for (const step of [-1, 1]) {
      const next = items[(index + step + items.length) % items.length];
      if (next?.kind === 'image' && next.url) new Image().src = next.url;
    }
  }, [index, items]);

  if (!item) return null;

  const onTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || zoomed) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
  };

  return createPortal(
    <div
      role='dialog'
      aria-modal='true'
      aria-label={item.name || (item.kind === 'video' ? 'Video' : 'Photo')}
      className='fixed inset-0 z-[100] flex flex-col bg-scrim/95 backdrop-blur-xl animate-in fade-in-0 duration-150'
      onTouchStart={(e) =>
        (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })
      }
      onTouchEnd={onTouchEnd}
    >
      <div className='relative z-10 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-on-scrim'>
        <div className='min-w-0 flex-1 px-1'>
          {item.name && <p className='truncate text-sm font-medium'>{item.name}</p>}
          {many && (
            <p className='text-xs tabular-nums text-on-scrim/60'>
              {index + 1} of {items.length}
            </p>
          )}
        </div>
        {item.downloadUrl && (
          <button
            type='button'
            className={control}
            onClick={() => onDownload(item)}
            aria-label='Download'
            title='Download'
          >
            <Download className='h-[18px] w-[18px]' />
          </button>
        )}
        <button
          ref={closeRef}
          type='button'
          className={control}
          onClick={onClose}
          aria-label='Close'
          title='Close'
        >
          <X className='h-5 w-5' />
        </button>
      </div>

      <div
        className='relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]'
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {item.kind === 'video' ? (
          <video
            key={item.key}
            src={item.url}
            controls
            autoPlay
            playsInline
            className='max-h-full max-w-full rounded-lg bg-black shadow-2xl'
          />
        ) : (
          <>
            {!loaded && (
              <span className='absolute h-8 w-8 animate-spin rounded-full border-2 border-on-scrim/25 border-t-on-scrim' />
            )}
            <img
              key={item.key}
              src={item.url}
              alt={item.name || ''}
              draggable={false}
              onLoad={() => setLoaded(true)}
              onClick={() => setZoomed((z) => !z)}
              className={cn(
                'max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl transition-[transform,opacity] duration-200 ease-out',
                zoomed ? 'scale-[1.8] cursor-zoom-out' : 'cursor-zoom-in',
                loaded ? 'opacity-100' : 'opacity-0'
              )}
            />
          </>
        )}

        {many && (
          <>
            <button
              type='button'
              className={cn(control, 'absolute left-3 top-1/2 -translate-y-1/2 max-sm:hidden')}
              onClick={() => go(-1)}
              aria-label='Previous'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              type='button'
              className={cn(control, 'absolute right-3 top-1/2 -translate-y-1/2 max-sm:hidden')}
              onClick={() => go(1)}
              aria-label='Next'
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default MediaViewer;
