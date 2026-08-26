import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSharedValue } from 'react-native-reanimated';
import SwipeableModal from '@/components/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';
import {
  fetchSoundFeed,
  searchSounds,
  QUICK_SOUND_PRESETS,
  SoundEffectItem,
  SoundPreset,
} from '@/utils/api/soundEffects';
import { soundEffectsManager } from '@/utils/soundEffectsManager';

interface SoundItemCardProps {
  sound: SoundEffectItem;
  isPlaying: boolean;
  onTogglePlay: (sound: SoundEffectItem) => void;
  onSend: (sound: SoundEffectItem) => void;
}

const SoundItemCard = memo<SoundItemCardProps>(({ sound, isPlaying, onTogglePlay, onSend }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.soundCard,
        {
          backgroundColor: isPlaying
            ? colors.primary + '15'
            : colors.card || colors.secondary + '60',
          borderColor: isPlaying ? colors.primary + '50' : colors.border + '35',
        },
      ]}
    >
      {/* Play/Stop Preview */}
      <TouchableOpacity
        onPress={() => onTogglePlay(sound)}
        activeOpacity={0.75}
        style={[
          styles.previewBtn,
          {
            backgroundColor: isPlaying ? colors.primary : colors.secondary,
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? 'stop' : 'play'}
          size={14}
          color={isPlaying ? colors.primaryForeground : colors.foreground}
          style={!isPlaying ? { marginLeft: 1.5 } : undefined}
        />
      </TouchableOpacity>

      {/* Title & Preview subtitle */}
      <TouchableOpacity
        onPress={() => onTogglePlay(sound)}
        activeOpacity={0.7}
        style={styles.soundInfo}
      >
        <Text style={[styles.soundTitle, { color: colors.foreground }]} numberOfLines={1}>
          {sound.name}
        </Text>
        <Text
          style={[
            styles.soundSub,
            { color: isPlaying ? colors.primary : colors.mutedForeground + '70' },
          ]}
        >
          {isPlaying ? 'Playing preview...' : 'Tap to preview'}
        </Text>
      </TouchableOpacity>

      {/* Send to Room Button */}
      <TouchableOpacity
        onPress={() => onSend(sound)}
        activeOpacity={0.8}
        style={[styles.sendSoundBtn, { backgroundColor: colors.primary }]}
      >
        <Feather name='send' size={12} color={colors.primaryForeground} />
        <Text style={[styles.sendSoundBtnText, { color: colors.primaryForeground }]}>Send</Text>
      </TouchableOpacity>
    </View>
  );
});

interface SoundPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSound: (sound: SoundEffectItem) => void;
}

export const SoundPickerModal: React.FC<SoundPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSound,
}) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [sounds, setSounds] = useState<SoundEffectItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const searchTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollOffset = useSharedValue(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y;
    },
    [scrollOffset]
  );

  const loadSounds = useCallback(async (searchQuery: string, pageNum = 1, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let res;
      if (searchQuery.trim()) {
        res = await searchSounds(searchQuery.trim(), pageNum, abortControllerRef.current.signal);
      } else {
        res = await fetchSoundFeed(pageNum, abortControllerRef.current.signal);
      }

      const newItems = res.data || [];
      setSounds((prev) => (append ? [...prev, ...newItems] : newItems));
      setHasMore(newItems.length > 0);
      setPage(pageNum);
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Failed to load soundboard sounds:', err);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSounds('', 1, false);
    } else {
      soundEffectsManager.stopPreview();
      setPlayingId(null);
    }
    return () => {
      soundEffectsManager.stopPreview();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isOpen, loadSounds]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setQuery(text);
      setSelectedPreset(null);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(() => {
        loadSounds(text, 1, false);
      }, 350);
    },
    [loadSounds]
  );

  const handlePresetClick = useCallback(
    (preset: SoundPreset) => {
      if (selectedPreset === preset.id) {
        setSelectedPreset(null);
        setQuery('');
        loadSounds('', 1, false);
        return;
      }
      setSelectedPreset(preset.id);
      setQuery(preset.query);
      loadSounds(preset.query, 1, false);
    },
    [selectedPreset, loadSounds]
  );

  const handleTogglePlay = useCallback(
    (sound: SoundEffectItem) => {
      if (playingId === sound.id) {
        soundEffectsManager.stopPreview();
        setPlayingId(null);
        return;
      }

      setPlayingId(sound.id);
      soundEffectsManager.playPreview(
        sound.url,
        () => setPlayingId(null),
        () => setPlayingId(null)
      );
    },
    [playingId]
  );

  const handleSend = useCallback(
    (sound: SoundEffectItem) => {
      soundEffectsManager.stopPreview();
      setPlayingId(null);
      onSelectSound(sound);
      onClose();
    },
    [onSelectSound, onClose]
  );

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    loadSounds(query, page + 1, true);
  }, [loadingMore, hasMore, loading, query, page, loadSounds]);

  const renderSoundCard = useCallback(
    ({ item }: { item: SoundEffectItem }) => (
      <SoundItemCard
        sound={item}
        isPlaying={playingId === item.id}
        onTogglePlay={handleTogglePlay}
        onSend={handleSend}
      />
    ),
    [playingId, handleTogglePlay, handleSend]
  );

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get('window').height * 0.85}
      style={{ height: Dimensions.get('window').height * 0.85 }}
      scrollable={true}
      scrollOffset={scrollOffset}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Ionicons name='volume-high' size={19} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Soundboard</Text>
            <View style={[styles.liveBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.liveBadgeText, { color: colors.primary }]}>LIVE</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name='x' size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.secondary }]}>
            <Feather name='search' size={15} color={colors.mutedForeground + '70'} />
            <TextInput
              value={query}
              onChangeText={handleSearchChange}
              placeholder='Search sound effects (e.g. bruh, vine boom)...'
              placeholderTextColor={colors.mutedForeground + '60'}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize='none'
              returnKeyType='search'
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setSelectedPreset(null);
                  loadSounds('', 1, false);
                }}
              >
                <Feather name='x-circle' size={15} color={colors.mutedForeground + '80'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Preset Chips */}
        <View style={styles.presetsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsContent}
          >
            <TouchableOpacity
              onPress={() => {
                setSelectedPreset(null);
                setQuery('');
                loadSounds('', 1, false);
              }}
              activeOpacity={0.8}
              style={[
                styles.presetChip,
                !selectedPreset && !query
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.secondary, borderColor: colors.border + '30' },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  {
                    color:
                      !selectedPreset && !query ? colors.primaryForeground : colors.mutedForeground,
                  },
                ]}
              >
                🔥 Trending
              </Text>
            </TouchableOpacity>

            {QUICK_SOUND_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => handlePresetClick(preset)}
                  activeOpacity={0.8}
                  style={[
                    styles.presetChip,
                    isSelected
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.secondary, borderColor: colors.border + '30' },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      {
                        color: isSelected ? colors.primaryForeground : colors.mutedForeground,
                      },
                    ]}
                  >
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sounds List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='small' color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading sounds...
            </Text>
          </View>
        ) : sounds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name='musical-notes-outline'
              size={36}
              color={colors.mutedForeground + '40'}
            />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              {query ? `No sound effects found for "${query}"` : 'No sound effects found'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sounds}
            renderItem={renderSoundCard}
            keyExtractor={(item, idx) => item.id || String(idx)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size='small' color={colors.primary} />
                </View>
              ) : (
                <View style={styles.footerBranding}>
                  <Text style={[styles.brandingText, { color: colors.mutedForeground + '50' }]}>
                    Powered by MyInstants
                  </Text>
                </View>
              )
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  liveBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  presetsWrap: {
    paddingBottom: 10,
  },
  presetsContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  soundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  soundTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  soundSub: {
    fontSize: 10.5,
  },
  sendSoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  sendSoundBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerBranding: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  brandingText: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default SoundPickerModal;
