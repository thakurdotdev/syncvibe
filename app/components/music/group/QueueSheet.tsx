import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/common/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { QueueItem } from '@/stores/groupMusic/types';

interface QueueSheetProps {
  onOpenSearch: () => void;
}

const QueueItemRow = React.memo(
  ({
    item,
    onRemove,
    colors,
  }: {
    item: QueueItem;
    onRemove: (id: string) => void;
    colors: any;
  }) => {
    const artist = item.song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

    return (
      <View style={[styles.queueItem, { borderBottomColor: colors.border }]}>
        <Image
          source={{ uri: item.song?.image?.[1]?.link }}
          style={[styles.itemArt, { backgroundColor: colors.secondary }]}
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
            {item.song?.name}
          </Text>
          <Text style={[styles.itemArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
          {item.addedBy && (
            <View style={styles.itemAddedBy}>
              {item.addedBy.profilePic ? (
                <Image
                  source={{ uri: String(item.addedBy.profilePic) }}
                  style={styles.itemAvatar}
                />
              ) : null}
              <Text style={[styles.itemAddedByText, { color: colors.mutedForeground }]}>
                {item.addedBy.userName}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onRemove(item.id)}
          style={[styles.removeButton, { backgroundColor: colors.secondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name='x' size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }
);

export const QueueSheet: React.FC<QueueSheetProps> = ({ onOpenSearch }) => {
  const { colors } = useTheme();
  const { removeFromQueue } = useGroupMusic();

  const isQueueOpen = useGroupSessionStore((s) => s.isQueueOpen);
  const queue = useGroupSessionStore((s) => s.queue);
  const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex);
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying);

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex]
  );

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex]
  );

  const handleClose = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: false });
  }, []);

  const handleRemove = useCallback(
    (queueItemId: string) => {
      removeFromQueue(queueItemId);
    },
    [removeFromQueue]
  );

  const handleAddSongs = useCallback(() => {
    handleClose();
    onOpenSearch();
  }, [handleClose, onOpenSearch]);

  const renderItem = useCallback(
    ({ item }: { item: QueueItem }) => (
      <QueueItemRow item={item} onRemove={handleRemove} colors={colors} />
    ),
    [handleRemove, colors]
  );

  const keyExtractor = useCallback((item: QueueItem) => item.id, []);

  const currentArtist =
    currentSong?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

  const renderHeader = useCallback(() => {
    if (!currentSong || !currentQueueItem) {
      if (upcomingQueue.length > 0) {
        return (
          <View style={styles.listHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UP NEXT</Text>
          </View>
        );
      }
      return null;
    }

    return (
      <View>
        <View style={[styles.nowPlaying, { backgroundColor: colors.secondary }]}>
          <View style={styles.nowPlayingLabel}>
            <Ionicons name='musical-note' size={12} color={colors.primary} />
            <Text style={[styles.nowPlayingText, { color: colors.primary }]}>NOW PLAYING</Text>
          </View>
          <View style={styles.nowPlayingSong}>
            <Image
              source={{ uri: currentSong.image?.[1]?.link }}
              style={styles.nowPlayingArt}
            />
            <View style={styles.nowPlayingInfo}>
              <Text
                style={[styles.nowPlayingName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {currentSong.name}
              </Text>
              <Text
                style={[styles.nowPlayingArtist, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {currentArtist}
              </Text>
            </View>
            {isPlaying && (
              <View style={styles.playingIndicator}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.playingBar, { backgroundColor: colors.primary }]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
        {upcomingQueue.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UP NEXT</Text>
          </View>
        )}
      </View>
    );
  }, [currentSong, currentQueueItem, upcomingQueue.length, colors, currentArtist, isPlaying]);

  return (
    <SwipeableModal
      isVisible={isQueueOpen}
      onClose={handleClose}
      maxHeight={Dimensions.get('screen').height}
      scrollable={true}
      hideHandle={true}
      style={styles.modalStyle}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleClose} style={styles.backButton}>
                <Ionicons name='arrow-back' size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Queue</Text>
              {upcomingQueue.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.countText, { color: colors.primaryForeground }]}>
                    {upcomingQueue.length}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={handleAddSongs}
              style={[styles.addButton, { backgroundColor: colors.primary }]}
            >
              <Feather name='plus' size={14} color={colors.primaryForeground} />
              <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>
                Add Songs
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={upcomingQueue}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <View style={styles.emptyQueue}>
                <Feather name='music' size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Queue is empty</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Search and add songs to keep the music going
                </Text>
                <TouchableOpacity
                  onPress={handleAddSongs}
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                >
                  <Feather name='search' size={16} color={colors.primaryForeground} />
                  <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                    Search Songs
                  </Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
  },
  listContent: {
    paddingBottom: 20,
  },
  listHeader: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  nowPlaying: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  nowPlayingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  nowPlayingText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nowPlayingSong: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowPlayingArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  nowPlayingInfo: {
    marginLeft: 10,
    flex: 1,
  },
  nowPlayingName: {
    fontSize: 14,
    fontWeight: '600',
  },
  nowPlayingArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
    marginLeft: 8,
  },
  playingBar: {
    width: 2.5,
    borderRadius: 1,
    height: '60%',
  },
  upNextSection: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  itemAddedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  itemAvatar: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  itemAddedByText: {
    fontSize: 10,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyQueue: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
