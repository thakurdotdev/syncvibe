import { fetchTrendingGifs, searchGifs, type GifItem } from '@/api/gifs';
import SwipeableModal from '@/components/SwipeableModal';
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

const COLUMN_GAP = 6;
const NUM_COLUMNS = 2;

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

const GifThumbnail = React.memo(
  ({
    gif,
    itemWidth,
    onSelect,
    colors,
  }: {
    gif: GifItem;
    itemWidth: number;
    onSelect: (url: string) => void;
    colors: any;
  }) => {
    const still = gif.still;
    const animated = gif.animated;
    const full = gif.full || animated;
    const aspectRatio = gif.aspectRatio || 1;

    return (
      <TouchableOpacity
        onPress={() => onSelect(full)}
        activeOpacity={0.8}
        style={[thumbnailStyles.card, { width: itemWidth, backgroundColor: colors.secondary }]}
      >
        <Image
          source={{ uri: animated || still }}
          style={[thumbnailStyles.image, { width: itemWidth, aspectRatio }]}
          resizeMode='cover'
        />
      </TouchableOpacity>
    );
  }
);

const thumbnailStyles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: COLUMN_GAP,
  },
  image: {
    minHeight: 80,
    maxHeight: 200,
  },
});

export const GifPickerModal: React.FC<GifPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [trending, setTrending] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const contentPadding = 16;
  const itemWidth = (screenWidth - contentPadding * 2 - COLUMN_GAP) / NUM_COLUMNS;

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetchTrendingGifs()
      .then((data) => {
        setTrending(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!text.trim()) {
      setGifs([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchGifs(text);
        setGifs(data || []);
      } catch {}
      setLoading(false);
    }, 350);
  }, []);

  const handleSelect = useCallback(
    (gifUrl: string) => {
      onSelect(gifUrl);
      onClose();
      setQuery('');
      setGifs([]);
    },
    [onSelect, onClose]
  );

  const displayGifs = query.trim() ? gifs : trending;

  const renderItem = useCallback(
    ({ item }: { item: GifItem }) => (
      <GifThumbnail gif={item} itemWidth={itemWidth} onSelect={handleSelect} colors={colors} />
    ),
    [itemWidth, handleSelect, colors]
  );

  const keyExtractor = useCallback((item: GifItem) => item.id, []);

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get('window').height * 0.7}
      style={{ height: Dimensions.get('window').height * 0.7 }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>GIFs</Text>
          <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
            Powered by KLIPY
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 'auto' }}
          >
            <Feather name='x' size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.secondary }]}>
          <Feather name='search' size={16} color={colors.mutedForeground + '80'} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={handleSearch}
            placeholder='Search GIFs...'
            placeholderTextColor={colors.mutedForeground + '60'}
            autoCapitalize='none'
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Feather name='x-circle' size={16} color={colors.mutedForeground + '60'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Grid */}
        {loading && displayGifs.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size='small' color={colors.primary} />
          </View>
        ) : displayGifs.length === 0 ? (
          <View style={styles.centered}>
            <Feather name='image' size={28} color={colors.mutedForeground + '30'} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground + '60' }]}>
              {query.trim() ? 'No GIFs found' : 'Search for GIFs'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayGifs}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  attribution: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  row: {
    gap: COLUMN_GAP,
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
});
