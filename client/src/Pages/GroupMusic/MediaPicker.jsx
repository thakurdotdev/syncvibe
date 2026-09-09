import { memo, useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import {
  Search,
  X,
  Film,
  Clapperboard,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchTrendingMedia, searchMedia } from '@/api/gifs';

const MEDIA_TABS = [
  { id: 'gifs', label: 'GIFs', icon: Film, placeholder: 'Search GIFs...' },
  { id: 'clips', label: 'Clips', icon: Clapperboard, placeholder: 'Search video clips...' },
  { id: 'stickers', label: 'Stickers', icon: Sparkles, placeholder: 'Search stickers...' },
];

/**
 * Individual Card for a GIF, Clip, or Sticker item
 */
const MediaCard = memo(({ item, type, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  const isSticker = type === 'stickers';
  const isClip = type === 'clips';

  // Preview image vs animated image
  const staticSrc = item.preview || item.gif;
  const animatedSrc = item.gif || item.preview;

  if (isSticker) {
    return (
      <button
        type='button'
        onClick={() => onSelect(item)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={item.title || 'Send sticker'}
        className='group relative w-full aspect-square rounded-xl overflow-hidden cursor-pointer border-0 p-2 bg-white/[0.03] hover:bg-white/[0.07] transition-all duration-150 flex items-center justify-center'
      >
        <img
          src={hovered ? animatedSrc : staticSrc}
          alt={item.title || 'Sticker'}
          loading='lazy'
          className='w-full h-full object-contain transition-transform duration-200 group-hover:scale-105'
        />
        {hovered && (
          <div className='absolute inset-0 rounded-xl pointer-events-none ring-1.5 ring-primary/60' />
        )}
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.title || 'Send media'}
      className='group relative w-full rounded-xl overflow-hidden cursor-pointer border-0 p-0 block bg-muted/25 transition-all duration-200 hover:shadow-md'
    >
      <img
        src={hovered ? animatedSrc : staticSrc}
        alt={item.title || 'Media preview'}
        loading='lazy'
        className='w-full h-auto max-h-[220px] min-h-[85px] object-cover rounded-xl block transition-transform duration-200 group-hover:scale-[1.02]'
      />

      {/* Subtle clip badge in corner */}
      {isClip && (
        <div className='absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 shadow-xs'>
          <Clapperboard className='h-2.5 w-2.5 text-amber-400' />
          <span className='text-[9px] font-semibold text-white/90 uppercase tracking-wider'>Clip</span>
        </div>
      )}

      {/* Hover selection outline glow */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-150',
          hovered ? 'opacity-100 ring-2 ring-primary ring-inset' : 'opacity-0'
        )}
      />
    </button>
  );
});

MediaCard.displayName = 'MediaCard';

/**
 * MediaPicker modal portal with Tabs (GIFs, Clips, Stickers) & Infinite Scrolling
 */
const MediaPicker = ({ anchorRef, toggleRef, onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState('gifs');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pos, setPos] = useState(null);

  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Position calculation relative to anchor
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
      width: rect.width,
    });
  }, [anchorRef]);

  // Focus search input after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Fetch media items helper
  const loadItems = useCallback(
    async (tabType, searchQuery, targetPage = 1, append = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      if (targetPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        let res;
        const cleanQuery = searchQuery?.trim();
        if (cleanQuery) {
          res = await searchMedia({
            query: cleanQuery,
            type: tabType,
            page: targetPage,
            signal,
          });
        } else {
          res = await fetchTrendingMedia({
            type: tabType,
            page: targetPage,
            signal,
          });
        }

        const newItems = res.data || [];
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setHasMore(newItems.length > 0);
        setPage(targetPage);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Failed to load media items:', err);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchTrendingMedia({ type: 'gifs', page: 1, signal: controller.signal })
      .then((res) => {
        if (!cancelled) {
          setItems(res.data || []);
          setHasMore((res.data || []).length > 0);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Failed to load initial media items:', err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Handle Tab Switch
  const handleTabChange = useCallback(
    (tabId) => {
      if (tabId === activeTab) return;
      setActiveTab(tabId);
      setPage(1);
      setHasMore(true);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      loadItems(tabId, query, 1, false);
    },
    [activeTab, query, loadItems]
  );

  // Handle Search Input Change
  const handleSearchChange = useCallback(
    (value) => {
      setQuery(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(() => {
        setPage(1);
        setHasMore(true);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        loadItems(activeTab, value, 1, false);
      }, 300);
    },
    [activeTab, loadItems]
  );

  // Handle Clear Search
  const handleClearSearch = useCallback(() => {
    setQuery('');
    setPage(1);
    setHasMore(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    loadItems(activeTab, '', 1, false);
    inputRef.current?.focus();
  }, [activeTab, loadItems]);

  // Handle Load More (Next Page)
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadItems(activeTab, query, page + 1, true);
  }, [loading, loadingMore, hasMore, activeTab, query, page, loadItems]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loading && !loadingMore && hasMore) {
          handleLoadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '160px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, handleLoadMore]);

  // Fallback Scroll Listener for Infinite Scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
      handleLoadMore();
    }
  }, [loading, loadingMore, hasMore, handleLoadMore]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        (!toggleRef?.current || !toggleRef.current.contains(e.target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, toggleRef]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Item selection handler
  const handleSelectMedia = useCallback(
    (item) => {
      const mediaUrl = item.gif || item.mp4 || item.preview;
      onSelect(mediaUrl, item);
    },
    [onSelect]
  );

  if (!pos) return null;

  const currentTabObj = MEDIA_TABS.find((t) => t.id === activeTab) || MEDIA_TABS[0];

  return ReactDOM.createPortal(
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className='fixed flex flex-col rounded-2xl overflow-hidden border border-border/30 shadow-2xl backdrop-blur-2xl'
      style={{
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        height: 480,
        zIndex: 9999,
        background: 'hsl(var(--background) / 0.98)',
        boxShadow: '0 -8px 40px -8px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border) / 0.15)',
      }}
    >
      {/* Sleek, Compact Header */}
      <div className='shrink-0 px-3 pt-2.5 pb-2 border-b border-border/15 space-y-2'>
        {/* Row 1: Search Input & Close Button */}
        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none' />
            <input
              ref={inputRef}
              type='text'
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={currentTabObj.placeholder}
              className='w-full rounded-xl h-8.5 pl-8 pr-8 text-xs outline-none transition-all duration-200'
              style={{
                background: 'hsl(var(--muted) / 0.45)',
                border: '1px solid hsl(var(--border) / 0.25)',
                color: 'hsl(var(--foreground))',
              }}
            />
            {query && (
              <button
                type='button'
                onClick={handleClearSearch}
                aria-label='Clear search'
                className='absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded flex items-center justify-center cursor-pointer border-0 bg-transparent text-muted-foreground/50 hover:text-foreground transition-colors'
              >
                <X className='h-3 w-3' />
              </button>
            )}
          </div>

          <button
            type='button'
            onClick={onClose}
            aria-label='Close media picker'
            className='h-8.5 w-8.5 rounded-xl flex items-center justify-center cursor-pointer border border-border/20 bg-muted/30 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {/* Row 2: Clean Pill Tabs (GIFs, Clips, Stickers) + Status info */}
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-1 p-0.5 rounded-xl bg-muted/40 border border-border/20'>
            {MEDIA_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/30'
                  )}
                >
                  <TabIcon className='h-3 w-3' />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className='text-[10.5px] text-muted-foreground/45 font-medium px-1'>
            {query.trim()
              ? items.length > 0
                ? `${items.length} items`
                : ''
              : 'Trending'}
          </span>
        </div>
      </div>

      {/* Media Grid / Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className='flex-1 overflow-y-auto chat-scroll-area p-2.5 min-h-0'
      >
        {loading && items.length === 0 ? (
          <div
            className={
              activeTab === 'stickers'
                ? 'grid grid-cols-3 sm:grid-cols-4 gap-2'
                : 'columns-2 sm:columns-3 gap-2'
            }
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl animate-pulse w-full mb-2',
                  activeTab === 'stickers' ? 'aspect-square mb-0' : i % 2 === 0 ? 'h-32' : 'h-24'
                )}
                style={{ background: 'hsl(var(--muted) / 0.25)' }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full gap-2 py-12 text-center'>
            <div className='h-9 w-9 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground/30'>
              <currentTabObj.icon className='h-4 w-4' />
            </div>
            <p className='text-xs text-muted-foreground/60 font-medium'>
              {query.trim()
                ? `No ${currentTabObj.label.toLowerCase()} found for "${query}"`
                : `No ${currentTabObj.label.toLowerCase()} available right now`}
            </p>
            {query.trim() && (
              <button
                type='button'
                onClick={handleClearSearch}
                className='text-[11px] text-primary hover:underline font-medium cursor-pointer bg-transparent border-0'
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'stickers' ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-2'>
                {items.map((item, idx) => (
                  <MediaCard
                    key={`${item.id}-${idx}`}
                    item={item}
                    type={activeTab}
                    onSelect={handleSelectMedia}
                  />
                ))}
              </div>
            ) : (
              <div className='columns-2 sm:columns-3 gap-2'>
                {items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className='break-inside-avoid mb-2'>
                    <MediaCard
                      item={item}
                      type={activeTab}
                      onSelect={handleSelectMedia}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className='h-4 w-full flex items-center justify-center' />

            {/* Loading indicator */}
            {hasMore && (
              <div className='flex justify-center pt-2 pb-1'>
                <button
                  type='button'
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className='text-xs font-medium text-muted-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted/60 px-3.5 py-1 rounded-full border border-border/15 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50'
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className='h-3 w-3 animate-spin text-primary' />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className='h-3 w-3' />
                      <span>Load More</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {!hasMore && items.length > 0 && (
              <p className='text-center text-[10px] text-muted-foreground/30 pt-3 pb-1'>
                End of results
              </p>
            )}

            {/* Subtle Klipy branding at the end of scroll */}
            <div className='flex justify-center items-center py-2.5'>
              <span className='text-[9px] text-muted-foreground/25 uppercase tracking-wider font-medium'>
                Powered by Klipy API
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>,
    document.body
  );
};

export default memo(MediaPicker);
