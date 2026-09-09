import {
  fetchTrendingMedia,
  searchMedia,
  type KlipyMediaItem,
  type MediaType,
} from '@/api/gifs';
import SwipeableModal from '@/components/SwipeableModal';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COLUMN_GAP = 8;
const CONTENT_PADDING = 16;

const MEDIA_TABS: TabItem<MediaType>[] = [
  {
    id: 'gifs',
    label: 'GIFs',
    icon: ({ size, color }) => <Feather name='film' size={size} color={color} />,
  },
  {
    id: 'clips',
    label: 'Clips',
    icon: ({ size, color }) => <Feather name='video' size={size} color={color} />,
  },
  {
    id: 'stickers',
    label: 'Stickers',
    icon: ({ size, color }) => <Feather name='smile' size={size} color={color} />,
  },
];

const TAB_PLACEHOLDERS: Record<MediaType, string> = {
  gifs: 'Search GIFs...',
  clips: 'Search video clips...',
  stickers: 'Search stickers...',
};

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mediaUrl: string) => void;
}

const MediaThumbnail = React.memo(
  ({
    item,
    type,
    itemWidth,
    onSelect,
    colors,
  }: {
    item: KlipyMediaItem;
    type: MediaType;
    itemWidth: number;
    onSelect: (url: string) => void;
    colors: any;
  }) => {
    const isSticker = type === 'stickers';
    const isClip = type === 'clips';
    const mediaUrl = item.gif || item.mp4 || item.preview;
    const displayImage = item.gif || item.preview;

    if (isSticker) {
      return (
        <TouchableOpacity
          onPress={() => onSelect(mediaUrl)}
          activeOpacity={0.75}
          style={[
            thumbnailStyles.stickerCard,
            {
              width: itemWidth,
              backgroundColor: colors.secondary + '40',
              borderColor: colors.border + '20',
            },
          ]}
        >
          <Image
            source={{ uri: displayImage }}
            style={thumbnailStyles.stickerImage}
            resizeMode='contain'
          />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => onSelect(mediaUrl)}
        activeOpacity={0.8}
        style={[
          thumbnailStyles.mediaCard,
          {
            width: itemWidth,
            backgroundColor: colors.secondary,
            borderColor: colors.border + '20',
          },
        ]}
      >
        <Image
          source={{ uri: displayImage }}
          style={[thumbnailStyles.mediaImage, { width: itemWidth }]}
          resizeMode='cover'
        />

        {/* Subtle Clip Badge */}
        {isClip && (
          <View style={thumbnailStyles.clipBadge}>
            <Feather name='video' size={9} color='#fbbf24' />
            <Text style={thumbnailStyles.clipBadgeText}>CLIP</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

MediaThumbnail.displayName = 'MediaThumbnail';

const thumbnailStyles = StyleSheet.create({
  mediaCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  mediaImage: {
    aspectRatio: 1.33,
    minHeight: 80,
    maxHeight: 180,
  },
  stickerCard: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  clipBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  clipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});

export const GifPickerModal: React.FC<GifPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<MediaType>('gifs');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KlipyMediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const isSticker = activeTab === 'stickers';
  const numColumns = isSticker ? 3 : 2;
  const itemWidth =
    (screenWidth - CONTENT_PADDING * 2 - COLUMN_GAP * (numColumns - 1)) / numColumns;

  // Load items helper
  const loadMedia = useCallback(
    async (tab: MediaType, searchQuery: string, targetPage = 1, append = false) => {
      if (targetPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const cleanQuery = searchQuery.trim();
        let res;
        if (cleanQuery) {
          res = await searchMedia({ query: cleanQuery, type: tab, page: targetPage });
        } else {
          res = await fetchTrendingMedia({ type: tab, page: targetPage });
        }

        const newItems = res.data || [];
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setHasMore(newItems.length > 0);
        setPage(targetPage);
      } catch (error) {
        console.error('Failed to load media in modal:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    fetchTrendingMedia({ type: 'gifs', page: 1 })
      .then((res) => {
        if (!cancelled) {
          setItems(res.data || []);
          setHasMore((res.data || []).length > 0);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load initial media in modal:', err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Tab switch handler
  const handleTabChange = useCallback(
    (newTab: MediaType) => {
      if (newTab === activeTab) return;
      setActiveTab(newTab);
      setPage(1);
      setHasMore(true);
      loadMedia(newTab, query, 1, false);
    },
    [activeTab, query, loadMedia]
  );

  // Search input change handler
  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      searchTimeout.current = setTimeout(() => {
        setPage(1);
        setHasMore(true);
        loadMedia(activeTab, text, 1, false);
      }, 300);
    },
    [activeTab, loadMedia]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setQuery('');
    setPage(1);
    setHasMore(true);
    loadMedia(activeTab, '', 1, false);
  }, [activeTab, loadMedia]);

  // Load next page (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadMedia(activeTab, query, page + 1, true);
  }, [loading, loadingMore, hasMore, activeTab, query, page, loadMedia]);

  // Item select handler
  const handleSelect = useCallback(
    (mediaUrl: string) => {
      onSelect(mediaUrl);
      onClose();
      setQuery('');
    },
    [onSelect, onClose]
  );

  const renderItem = useCallback(
    ({ item }: { item: KlipyMediaItem }) => (
      <MediaThumbnail
        item={item}
        type={activeTab}
        itemWidth={itemWidth}
        onSelect={handleSelect}
        colors={colors}
      />
    ),
    [activeTab, itemWidth, handleSelect, colors]
  );

  const keyExtractor = useCallback((item: KlipyMediaItem, index: number) => `${item.id}-${index}`, []);

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get('window').height * 0.78}
      style={{ height: Dimensions.get('window').height * 0.78 }}
    >
      <View style={styles.container}>
        {/* Header Row 1: Search Bar & Close Button */}
        <View style={styles.topBar}>
          <View style={[styles.searchContainer, { backgroundColor: colors.secondary }]}>
            <Feather name='search' size={15} color={colors.mutedForeground + '80'} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={query}
              onChangeText={handleSearch}
              placeholder={TAB_PLACEHOLDERS[activeTab]}
              placeholderTextColor={colors.mutedForeground + '60'}
              autoCapitalize='none'
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name='x-circle' size={16} color={colors.mutedForeground + '80'} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.closeButton, { backgroundColor: colors.secondary }]}
          >
            <Feather name='x' size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Header Row 2: Consistent UI Tabs & Counter */}
        <View style={styles.tabsRow}>
          <Tabs<MediaType>
            tabs={MEDIA_TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            variant='pills'
            size='sm'
            scrollable={false}
            containerStyle={styles.tabsContainer}
          />

          <Text style={[styles.counterText, { color: colors.mutedForeground + '60' }]}>
            {query.trim() ? (items.length > 0 ? `${items.length} items` : '') : 'Trending'}
          </Text>
        </View>

        {/* Media Grid with Infinite Scroll */}
        {loading && items.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size='small' color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Feather name='image' size={28} color={colors.mutedForeground + '30'} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground + '60' }]}>
              {query.trim()
                ? `No ${activeTab} found for "${query}"`
                : `No ${activeTab} available`}
            </Text>
            {query.trim().length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  Clear search
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            key={`grid-${numColumns}`}
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={numColumns}
            columnWrapperStyle={{ gap: COLUMN_GAP, marginBottom: COLUMN_GAP }}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size='small' color={colors.primary} />
                </View>
              ) : !hasMore && items.length > 0 ? (
                <View style={styles.endContainer}>
                  <Text style={[styles.endText, { color: colors.mutedForeground + '40' }]}>
                    End of results • Klipy API
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  closeButton: {
    height: 38,
    width: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 6,
    gap: 8,
  },
  tabsContainer: {
    marginVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'flex-start',
    gap: 6,
  },
  counterText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  grid: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  endContainer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  endText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
