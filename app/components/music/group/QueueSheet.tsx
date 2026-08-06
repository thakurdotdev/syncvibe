import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Feather, Ionicons } from "@expo/vector-icons"
import SwipeableModal from "@/components/SwipeableModal"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/context/ThemeContext"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { useGroupPlaybackStore } from "@/stores/groupMusic/groupPlaybackStore"
import { QueueItem } from "@/stores/groupMusic/types"
import { Song } from "@/types/song"
import { searchSongs } from "@/utils/api/getSongs"
import { ensureHttpsForSongUrls } from "@/utils/getHttpsUrls"

type TabKey = "queue" | "search" | "recommended"

interface QueueSheetProps {
  onOpenSearch: () => void
}

const QueueItemRow = React.memo(
  ({
    item,
    onRemove,
    onPlayNext,
    colors,
  }: {
    item: QueueItem
    onRemove: (id: string) => void
    onPlayNext?: (song: Song) => void
    colors: any
  }) => {
    const artist = item.song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

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
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    )
  },
)

const SearchResultRow = React.memo(
  ({
    song,
    onAddToQueue,
    onPlayNow,
    onPlayNext,
    colors,
  }: {
    song: Song
    onAddToQueue: (song: Song) => void
    onPlayNow: (song: Song) => void
    onPlayNext: (song: Song) => void
    colors: any
  }) => {
    const artist = song.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

    return (
      <View style={[styles.searchItem, { borderBottomColor: colors.border }]}>
        <Image
          source={{ uri: song.image?.[1]?.link }}
          style={[styles.itemArt, { backgroundColor: colors.secondary }]}
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.itemArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <View style={styles.searchActions}>
          <TouchableOpacity
            onPress={() => onPlayNext(song)}
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="skip-forward" size={13} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onPlayNow(song)}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="play" size={13} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAddToQueue(song)}
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="plus" size={14} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    )
  },
)

export const QueueSheet: React.FC<QueueSheetProps> = ({ onOpenSearch }) => {
  const { colors } = useTheme()
  const { removeFromQueue, addToQueue, playNow, playNext } = useGroupMusic()
  const insets = useSafeAreaInsets()

  const isQueueOpen = useGroupSessionStore((s) => s.isQueueOpen)
  const queue = useGroupSessionStore((s) => s.queue)
  const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex)
  const currentSong = useGroupPlaybackStore((s) => s.currentSong)
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying)

  const [activeTab, setActiveTab] = useState<TabKey>("queue")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recommendations, setRecommendations] = useState<Song[]>([])
  const [isLoadingRecs, setIsLoadingRecs] = useState(false)
  const searchTimer = useRef<any>(null)
  const inputRef = useRef<TextInput>(null)

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex],
  )

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex],
  )

  useEffect(() => {
    if (isQueueOpen) {
      setActiveTab("queue")
      setSearchQuery("")
      setSearchResults([])
    }
  }, [isQueueOpen])

  useEffect(() => {
    if (activeTab === "recommended" && recommendations.length === 0 && currentSong?.id) {
      loadRecommendations()
    }
  }, [activeTab, currentSong?.id])

  const loadRecommendations = useCallback(async () => {
    if (!currentSong?.id) return
    setIsLoadingRecs(true)
    try {
      const { getRelatedSongs } = await import("@/api/music")
      const recs = await getRelatedSongs(currentSong.id)
      setRecommendations(recs)
    } catch {
      setRecommendations([])
    } finally {
      setIsLoadingRecs(false)
    }
  }, [currentSong?.id])

  const handleClose = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: false })
  }, [])

  const handleRemove = useCallback(
    (queueItemId: string) => removeFromQueue(queueItemId),
    [removeFromQueue],
  )

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchSongs(query)
        setSearchResults(results.map(ensureHttpsForSongUrls))
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [])

  const handleAddToQueue = useCallback(
    (song: Song) => addToQueue(song),
    [addToQueue],
  )

  const handlePlayNow = useCallback(
    (song: Song) => playNow(song),
    [playNow],
  )

  const handlePlayNext = useCallback(
    (song: Song) => playNext(song),
    [playNext],
  )

  const currentArtist = currentSong?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

  const renderQueueItem = useCallback(
    ({ item }: { item: QueueItem }) => (
      <QueueItemRow item={item} onRemove={handleRemove} colors={colors} />
    ),
    [handleRemove, colors],
  )

  const renderSearchResult = useCallback(
    ({ item }: { item: Song }) => (
      <SearchResultRow
        song={item}
        onAddToQueue={handleAddToQueue}
        onPlayNow={handlePlayNow}
        onPlayNext={handlePlayNext}
        colors={colors}
      />
    ),
    [handleAddToQueue, handlePlayNow, handlePlayNext, colors],
  )

  const queueKeyExtractor = useCallback((item: QueueItem) => item.id, [])
  const songKeyExtractor = useCallback((item: Song) => item.id, [])

  const renderQueueHeader = useCallback(() => {
    if (!currentSong || !currentQueueItem) {
      if (upcomingQueue.length > 0) {
        return (
          <View style={styles.listHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UP NEXT</Text>
          </View>
        )
      }
      return null
    }

    return (
      <View>
        <View style={[styles.nowPlaying, { backgroundColor: colors.secondary }]}>
          <View style={styles.nowPlayingLabel}>
            <Ionicons name="musical-note" size={12} color={colors.primary} />
            <Text style={[styles.nowPlayingText, { color: colors.primary }]}>NOW PLAYING</Text>
          </View>
          <View style={styles.nowPlayingSong}>
            <Image source={{ uri: currentSong.image?.[1]?.link }} style={styles.nowPlayingArt} />
            <View style={styles.nowPlayingInfo}>
              <Text style={[styles.nowPlayingName, { color: colors.foreground }]} numberOfLines={1}>
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
                  <View key={i} style={[styles.playingBar, { backgroundColor: colors.primary }]} />
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
    )
  }, [currentSong, currentQueueItem, upcomingQueue.length, colors, currentArtist, isPlaying])

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "queue", label: "Queue", icon: "list" },
    { key: "search", label: "Search", icon: "search" },
    { key: "recommended", label: "For You", icon: "zap" },
  ]

  const statusBarHeight = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : insets.top
  const topPadding = Math.max(statusBarHeight, insets.top || 0, 24)

  return (
    <SwipeableModal
      isVisible={isQueueOpen}
      onClose={handleClose}
      maxHeight={Dimensions.get("screen").height}
      scrollable={true}
      hideHandle={true}
      style={styles.modalStyle}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleClose} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.foreground} />
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
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border + "30" }]}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    setActiveTab(tab.key)
                    if (tab.key === "search") {
                      setTimeout(() => inputRef.current?.focus(), 200)
                    }
                  }}
                  style={[
                    styles.tab,
                    active && [styles.tabActive, { borderBottomColor: colors.primary }],
                  ]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={14}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: active ? colors.primary : colors.mutedForeground },
                      active && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Tab Content */}
          {activeTab === "queue" && (
            <FlatList
              data={upcomingQueue}
              keyExtractor={queueKeyExtractor}
              renderItem={renderQueueItem}
              ListHeaderComponent={renderQueueHeader}
              ListEmptyComponent={
                <View style={styles.emptyQueue}>
                  <Feather name="music" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Queue is empty
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                    Search and add songs to keep the music going
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveTab("search")}
                    style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                  >
                    <Feather name="search" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                      Search Songs
                    </Text>
                  </TouchableOpacity>
                </View>
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {activeTab === "search" && (
            <View style={styles.flex}>
              <View style={styles.searchBarContainer}>
                <Input
                  ref={inputRef}
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  variant="outline"
                  containerStyle={styles.searchInput}
                  leftIcon={<Feather name="search" size={16} color={colors.mutedForeground} />}
                  rightIcon={
                    searchQuery ? (
                      <TouchableOpacity onPress={() => handleSearch("")}>
                        <Feather name="x" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    ) : null
                  }
                />
              </View>
              {isSearching ? (
                <View style={styles.centeredState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={songKeyExtractor}
                  renderItem={renderSearchResult}
                  ListEmptyComponent={
                    searchQuery.trim() ? (
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
                />
              )}
            </View>
          )}

          {activeTab === "recommended" && (
            <View style={styles.flex}>
              {isLoadingRecs ? (
                <View style={styles.centeredState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                    Finding songs for you...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={recommendations}
                  keyExtractor={songKeyExtractor}
                  renderItem={renderSearchResult}
                  ListEmptyComponent={
                    <View style={styles.centeredState}>
                      <Feather name="zap" size={28} color={colors.mutedForeground + "40"} />
                      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                        No recommendations yet
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                        Play a song to get personalized recommendations
                      </Text>
                    </View>
                  }
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          )}
        </View>
    </SwipeableModal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalStyle: {
    height: Dimensions.get("screen").height,
    position: "absolute",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 8,
  },
  searchInput: {
    flex: 1,
  },
  nowPlaying: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  nowPlayingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  nowPlayingText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  nowPlayingSong: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "600",
  },
  nowPlayingArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  playingIndicator: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 14,
    marginLeft: 8,
  },
  playingBar: {
    width: 2.5,
    borderRadius: 1,
    height: "60%",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop:20,
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
    fontWeight: "500",
  },
  itemArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  itemAddedBy: {
    flexDirection: "row",
    alignItems: "center",
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
  searchActions: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  emptyQueue: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
})
