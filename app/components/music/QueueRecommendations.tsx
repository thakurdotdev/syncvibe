import { usePlayerControls, usePlaybackState } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useSongRecommendationsQuery } from '@/queries/useMusic';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RefreshCw, Plus, X } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const SkeletonCard = memo(({ colors }: { colors: any }) => (
  <View style={[skeletonStyles.card, { backgroundColor: colors.card }]}>
    <View style={[skeletonStyles.image, { backgroundColor: colors.muted }]} />
    <View style={skeletonStyles.textArea}>
      <View
        style={[skeletonStyles.titleLine, { backgroundColor: colors.muted }]}
      />
      <View
        style={[skeletonStyles.subtitleLine, { backgroundColor: colors.muted }]}
      />
    </View>
  </View>
));

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  textArea: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  titleLine: {
    height: 12,
    borderRadius: 4,
    width: '70%',
  },
  subtitleLine: {
    height: 10,
    borderRadius: 4,
    width: '45%',
  },
});

const RecommendationItem = memo(
  ({
    song,
    onAdd,
    colors,
  }: {
    song: Song;
    onAdd: (song: Song) => void;
    colors: any;
  }) => {
    const artistName =
      song.subtitle || song.artist_map?.artists?.[0]?.name || 'Unknown';
    const imageUrl = song.image?.[1]?.link;

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
      >
        <View
          style={[recItemStyles.container, { backgroundColor: colors.card }]}
        >
          <Image
            source={{ uri: imageUrl }}
            style={recItemStyles.image}
            resizeMode="cover"
          />
          <View style={recItemStyles.info}>
            <Text
              style={[recItemStyles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {song.name}
            </Text>
            <Text
              style={[
                recItemStyles.artist,
                { color: colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {artistName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onAdd(song)}
            activeOpacity={0.7}
            style={[recItemStyles.addBtn, { backgroundColor: colors.primary + '18' }]}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
);

const recItemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    fontSize: 12,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

const QueueRecommendations = memo(() => {
  const { colors } = useTheme();
  const { currentSong } = usePlaybackState();
  const { addToQueue } = usePlayerControls();
  const [isDismissed, setIsDismissed] = useState(false);
  const dismissedForSongId = useRef<string | null>(null);

  const {
    data: recommendations = [],
    isLoading,
    refetch,
    isFetching,
  } = useSongRecommendationsQuery(currentSong?.id, {
    enabled: !!currentSong?.id && !isDismissed,
  });

  useEffect(() => {
    if (currentSong?.id !== dismissedForSongId.current && isDismissed) {
      setIsDismissed(false);
      dismissedForSongId.current = null;
    }
  }, [currentSong?.id, isDismissed]);

  const handleAdd = useCallback(
    (song: Song) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addToQueue(song);
      toast('Added to queue');
    },
    [addToQueue]
  );

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    dismissedForSongId.current = currentSong?.id ?? null;
  }, [currentSong?.id]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
  }, [refetch]);

  if (isDismissed) return null;
  if (!currentSong?.id) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[containerStyles.wrapper, { borderTopColor: colors.border }]}
    >
      <View style={containerStyles.header}>
        <Text style={[containerStyles.title, { color: colors.text }]}>
          Recommended
        </Text>
        <View style={containerStyles.headerActions}>
          <TouchableOpacity
            onPress={handleRefresh}
            activeOpacity={0.7}
            style={containerStyles.headerBtn}
            disabled={isFetching}
          >
            {isFetching ? (
              <ActivityIndicator size={16} color={colors.primary} />
            ) : (
              <RefreshCw size={16} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDismiss}
            activeOpacity={0.7}
            style={containerStyles.headerBtn}
          >
            <X size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={containerStyles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      ) : recommendations.length === 0 ? (
        <View style={containerStyles.emptyState}>
          <Ionicons
            name="sparkles-outline"
            size={24}
            color={colors.mutedForeground}
          />
          <Text
            style={[
              containerStyles.emptyText,
              { color: colors.mutedForeground },
            ]}
          >
            No recommendations available
          </Text>
        </View>
      ) : (
        <FlatList
          data={recommendations.slice(0, 8)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecommendationItem
              song={item}
              onAdd={handleAdd}
              colors={colors}
            />
          )}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
});

const containerStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonList: {
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default QueueRecommendations;
