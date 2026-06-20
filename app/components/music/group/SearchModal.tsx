import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeableModal from '@/components/common/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { Song } from '@/types/song';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchResultItem = React.memo(
  ({
    item,
    onPlayNow,
    onAddToQueue,
    colors,
  }: {
    item: Song;
    onPlayNow: (song: Song) => void;
    onAddToQueue: (song: Song) => void;
    colors: any;
  }) => {
    const artist = item.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

    return (
      <View style={[styles.resultItem, { borderBottomColor: colors.border }]}>
        <Image
          source={{ uri: item.image?.[1]?.link || 'https://via.placeholder.com/50' }}
          style={[styles.resultArt, { backgroundColor: colors.secondary }]}
        />
        <View style={styles.resultInfo}>
          <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.resultArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => onPlayNow(item)}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name='play' size={14} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAddToQueue(item)}
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name='plus' size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { colors } = useTheme();
  const { playNow, addToQueue } = useGroupMusic();
  const inputRef = useRef<TextInput>(null);

  const searchQuery = useGroupSessionStore((s) => s.searchQuery);
  const searchResults = useGroupSessionStore((s) => s.searchResults);
  const isSearchLoading = useGroupSessionStore((s) => s.isSearchLoading);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSearchChange = useCallback((query: string) => {
    useGroupSessionStore.getState().performSearch(query);
  }, []);

  const handleClose = useCallback(() => {
    useGroupSessionStore.getState().clearSearch();
    onClose();
  }, [onClose]);

  const handlePlayNow = useCallback(
    (song: Song) => {
      playNow(song);
    },
    [playNow]
  );

  const handleAddToQueue = useCallback(
    (song: Song) => {
      addToQueue(song);
    },
    [addToQueue]
  );

  const renderItem = useCallback(
    ({ item }: { item: Song }) => (
      <SearchResultItem
        item={item}
        onPlayNow={handlePlayNow}
        onAddToQueue={handleAddToQueue}
        colors={colors}
      />
    ),
    [handlePlayNow, handleAddToQueue, colors]
  );

  const keyExtractor = useCallback((item: Song) => item.id, []);

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={handleClose}
      maxHeight={Dimensions.get('screen').height}
      scrollable={true}
      hideHandle={true}
      style={styles.modalStyle}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Ionicons name='arrow-back' size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Input
              ref={inputRef}
              placeholder='Search for songs...'
              value={searchQuery}
              onChangeText={handleSearchChange}
              variant='outline'
              containerStyle={styles.inputContainer}
              leftIcon={<Feather name='search' size={18} color={colors.mutedForeground} />}
              rightIcon={
                searchQuery ? (
                  <TouchableOpacity onPress={() => handleSearchChange('')}>
                    <Feather name='x' size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>

          {isSearchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ListEmptyComponent={
                searchQuery ? (
                  <View style={styles.emptyContainer}>
                    <Feather name='search' size={40} color={colors.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      No results found
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      Try a different search term
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Feather name='music' size={40} color={colors.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Search for music
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      Find songs to play or add to queue
                    </Text>
                  </View>
                )
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={[styles.legend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name='play' size={8} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Play Now</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: colors.secondary }]}>
                <Feather name='plus' size={8} color={colors.foreground} />
              </View>
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                Add to Queue
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  modalStyle: {
    height: Dimensions.get('screen').height,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingRight: 16,
  },
  inputContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  listContent: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultArt: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  resultInfo: {
    marginLeft: 14,
    flex: 1,
  },
  resultName: {
    fontWeight: '500',
    fontSize: 15,
  },
  resultArtist: {
    fontSize: 13,
    marginTop: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '500',
    marginTop: 16,
    fontSize: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 11,
  },
});
