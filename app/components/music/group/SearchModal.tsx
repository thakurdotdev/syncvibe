import { Feather, Ionicons } from "@expo/vector-icons"
import React, { useCallback, useEffect, useRef } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import SwipeableModal from "@/components/SwipeableModal"
import { Input } from "@/components/ui/input"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useTheme } from "@/context/ThemeContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { Song } from "@/types/song"
import { useSharedValue } from "react-native-reanimated"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

const SearchResultItem = React.memo(
  ({
    item,
    onPlayNow,
    onAddToQueue,
    colors,
  }: {
    item: Song
    onPlayNow: (song: Song) => void
    onAddToQueue: (song: Song) => void
    colors: any
  }) => {
    const artist = item.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

    return (
      <View style={[styles.resultItem, { borderBottomColor: colors.border + "30" }]}>
        <Image
          source={{ uri: item.image?.[1]?.link || "https://via.placeholder.com/50" }}
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
            <Ionicons name="play" size={13} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAddToQueue(item)}
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="plus" size={14} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }
)

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { colors } = useTheme()
  const { playNow, addToQueue } = useGroupMusic()
  const inputRef = useRef<TextInput>(null)
  const insets = useSafeAreaInsets()
  const scrollOffset = useSharedValue(0)

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y
    },
    [scrollOffset]
  )

  const searchQuery = useGroupSessionStore((s) => s.searchQuery)
  const searchResults = useGroupSessionStore((s) => s.searchResults)
  const isSearchLoading = useGroupSessionStore((s) => s.isSearchLoading)

  useEffect(() => {
    if (isOpen) {
      scrollOffset.value = 0
      const timer = setTimeout(() => inputRef.current?.focus(), 350)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSearchChange = useCallback((query: string) => {
    useGroupSessionStore.getState().performSearch(query)
  }, [])

  const handleClose = useCallback(() => {
    useGroupSessionStore.getState().clearSearch()
    onClose()
  }, [onClose])

  const handlePlayNow = useCallback(
    (song: Song) => {
      playNow(song)
    },
    [playNow]
  )

  const handleAddToQueue = useCallback(
    (song: Song) => {
      addToQueue(song)
    },
    [addToQueue]
  )

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
  )

  const keyExtractor = useCallback((item: Song) => item.id, [])

  const statusBarHeight = Platform.OS === "android" ? StatusBar.currentHeight || 24 : insets.top
  const topPadding = Math.max(statusBarHeight, insets.top || 0, 24)

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={handleClose}
      maxHeight="100%"
      scrollable={true}
      scrollOffset={scrollOffset}
      hideHandle={true}
      fullScreen
    >
      <View style={styles.container}>
        <View style={[styles.searchHeader, { paddingTop: topPadding + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Input
            ref={inputRef}
            placeholder="Search for songs..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            variant="filled"
            containerStyle={styles.inputContainer}
            leftIcon={<Feather name="search" size={16} color={colors.mutedForeground} />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity onPress={() => handleSearchChange("")}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null
            }
          />
        </View>

        {isSearchLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={
              searchQuery ? (
                <View style={styles.centeredState}>
                  <Feather name="search" size={28} color={colors.mutedForeground + "40"} />
                  <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                    No results found
                  </Text>
                </View>
              ) : (
                <View style={styles.centeredState}>
                  <Feather name="search" size={28} color={colors.mutedForeground + "40"} />
                  <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                    Search for songs to add
                  </Text>
                </View>
              )
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )}
      </View>
    </SwipeableModal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    paddingRight: 12,
  },
  inputContainer: {
    flex: 1,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  resultInfo: {
    marginLeft: 12,
    flex: 1,
  },
  resultName: {
    fontWeight: "500",
    fontSize: 14,
  },
  resultArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
})
