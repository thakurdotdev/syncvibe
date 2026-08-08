import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { useUser } from "@/context/UserContext"
import useApi from "@/utils/hooks/useApi"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { useGroupPlaybackStore } from "@/stores/groupMusic/groupPlaybackStore"
import { QueueItem } from "@/stores/groupMusic/types"
import { Song } from "@/types/song"
import { searchSongs } from "@/utils/api/getSongs"
import { ensureHttpsForSongUrls } from "@/utils/getHttpsUrls"
import { useSharedValue } from "react-native-reanimated"
import {
  fetchSongRecommendations,
  getGroupHistory,
  getHomePageMusic,
  getMusicHistory,
} from "@/api/music"

type TabKey = "queue" | "playlists" | "recommended"

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
  }
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
  }
)

const PlaylistBrowser: React.FC<{
  onPlayNow: (song: Song) => void
  onPlayNext: (song: Song) => void
  onAddToQueue: (song: Song) => void
  onAddAll: (songs: Song[]) => void
  colors: any
}> = ({ onPlayNow, onPlayNext, onAddToQueue, onAddAll, colors }) => {
  const api = useApi()
  const [playlists, setPlaylists] = useState<any[]>([])
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string } | null>(null)
  const [playlistDetail, setPlaylistDetail] = useState<any | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const fetchPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true)
    try {
      const response = await api.get("/api/playlist/get")
      setPlaylists(response.data?.data || [])
    } catch (err) {
      console.error("Failed to fetch playlists:", err)
      setPlaylists([])
    } finally {
      setIsLoadingPlaylists(false)
    }
  }, [api])

  useEffect(() => {
    fetchPlaylists()
  }, [fetchPlaylists])

  const handleSelectPlaylist = useCallback(
    async (pl: any) => {
      setSelectedPlaylist({ id: pl.id, name: pl.name })
      setIsLoadingDetail(true)
      try {
        const response = await api.get("/api/playlist/details", { params: { id: pl.id } })
        setPlaylistDetail(response.data?.data || null)
      } catch (err) {
        console.error("Failed to fetch playlist details:", err)
        setPlaylistDetail(null)
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [api]
  )

  const songs: Song[] = useMemo(() => {
    if (!playlistDetail?.songs) return []
    return playlistDetail.songs
      .map((item: any) => ensureHttpsForSongUrls(item.songData || item))
      .filter((s: Song) => s?.id)
  }, [playlistDetail])

  if (selectedPlaylist) {
    return (
      <View style={styles.flex}>
        <View style={[styles.playlistDetailHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setSelectedPlaylist(null)
              setPlaylistDetail(null)
            }}
            style={[styles.backButton, { backgroundColor: colors.secondary }]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
              {selectedPlaylist.name}
            </Text>
            <Text style={[styles.itemArtist, { color: colors.mutedForeground }]}>
              {songs.length} songs
            </Text>
          </View>
          {songs.length > 0 && (
            <TouchableOpacity
              onPress={() => onAddAll(songs)}
              style={[styles.addAllBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text style={[styles.addAllBtnText, { color: colors.primaryForeground }]}>
                Add All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoadingDetail ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : songs.length === 0 ? (
          <View style={styles.centeredState}>
            <Feather name="music" size={28} color={colors.mutedForeground + "40"} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              This playlist is empty
            </Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SearchResultRow
                song={item}
                onAddToQueue={onAddToQueue}
                onPlayNow={onPlayNow}
                onPlayNext={onPlayNext}
                colors={colors}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    )
  }

  if (isLoadingPlaylists) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (playlists.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Feather name="disc" size={28} color={colors.mutedForeground + "40"} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No playlists yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Create playlists from your music library
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => {
        const imageUrl =
          typeof item.image === "string"
            ? item.image
            : item.image?.[1]?.link || item.image?.[0]?.link || ""
        return (
          <TouchableOpacity
            onPress={() => handleSelectPlaylist(item)}
            style={[styles.playlistRow, { borderBottomColor: colors.border }]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={[styles.itemArt, { backgroundColor: colors.secondary }]}
            />
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.itemArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.description || "Custom Playlist"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )
      }}
      showsVerticalScrollIndicator={false}
    />
  )
}

export const QueueSheet: React.FC = () => {
  const api = useApi()
  const { user } = useUser()
  const { colors } = useTheme()
  const { removeFromQueue, addToQueue, playNow, playNext, addPlaylistToQueue } = useGroupMusic()
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

  const recommendations = useGroupSessionStore((s) => s.quickPickRecs)
  const setRecommendations = useCallback((updater: Song[] | ((prev: Song[]) => Song[])) => {
    if (typeof updater === "function") {
      useGroupSessionStore.setState((s) => ({ quickPickRecs: updater(s.quickPickRecs) }))
    } else {
      useGroupSessionStore.setState({ quickPickRecs: updater })
    }
  }, [])

  const lastRecsSongIdRef = useRef<string | null>(null)
  const queueRef = useRef(queue)
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsSourceName, setRecsSourceName] = useState("")
  const [recsLockedSongId, setRecsLockedSongId] = useState<string | null>(null)

  const searchTimer = useRef<any>(null)
  const inputRef = useRef<TextInput>(null)
  const scrollOffset = useSharedValue(0)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    if (queue.length === 0 && recsLockedSongId) {
      setRecsLockedSongId(null)
    }
  }, [queue.length, recsLockedSongId])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y
    },
    [scrollOffset]
  )

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex]
  )

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex]
  )

  useEffect(() => {
    if (isQueueOpen) {
      setActiveTab("queue")
      setSearchQuery("")
      setSearchResults([])
      scrollOffset.value = 0
    }
  }, [isQueueOpen])

  const fetchRecs = useCallback(
    async (songId: string, force = false) => {
      if (!songId) return
      if (!force && lastRecsSongIdRef.current === songId) return
      lastRecsSongIdRef.current = songId
      setRecsLoading(true)
      const currentQueue = queueRef.current || []
      const songItem = currentQueue.find((q) => q.song?.id === songId)
      setRecsSourceName(songItem?.song?.name || "")
      try {
        const data = await fetchSongRecommendations(api, songId)
        const existingIds = new Set(currentQueue.map((q) => q.song?.id))
        const filtered = (data || []).filter((s) => !existingIds.has(s.id))
        setRecommendations(filtered.slice(0, 15))
      } catch {
        setRecommendations([])
      } finally {
        setRecsLoading(false)
      }
    },
    [api, setRecommendations]
  )

  const fetchSmartFallbackRecs = useCallback(
    async (force = false) => {
      if (!force && lastRecsSongIdRef.current === "fallback") return
      lastRecsSongIdRef.current = "fallback"
      setRecsLoading(true)

      try {
        if (user?.userid) {
          const groupHist = await getGroupHistory(api, String(user.userid))
          if (groupHist && groupHist.length > 0) {
            const lastSong = groupHist[groupHist.length - 1]?.songData
            if (lastSong?.id) {
              setRecsSourceName(`Last Session: ${lastSong.name}`)
              const data = await fetchSongRecommendations(api, lastSong.id)
              if (data && data.length > 0) {
                const currentQueue = queueRef.current || []
                const existingIds = new Set(currentQueue.map((q) => q.song?.id))
                const filtered = data.filter((s) => !existingIds.has(s.id))
                setRecommendations(filtered.slice(0, 15))
                return
              }
            }
          }
        }

        const musicHist = await getMusicHistory(api, { page: 1, limit: 5 })
        if (musicHist?.songs && musicHist.songs.length > 0) {
          const lastSong = musicHist.songs[0]
          if (lastSong?.id) {
            setRecsSourceName(`Music History: ${lastSong.name}`)
            const data = await fetchSongRecommendations(api, lastSong.id)
            if (data && data.length > 0) {
              const currentQueue = queueRef.current || []
              const existingIds = new Set(currentQueue.map((q) => q.song?.id))
              const filtered = data.filter((s) => !existingIds.has(s.id))
              setRecommendations(filtered.slice(0, 15))
              return
            }
          }
        }

        const modules = await getHomePageMusic()
        if (modules?.trending?.data && modules.trending.data.length > 0) {
          setRecsSourceName("Trending Now")
          const currentQueue = queueRef.current || []
          const existingIds = new Set(currentQueue.map((q) => q.song?.id))
          const filtered = modules.trending.data
            .map(ensureHttpsForSongUrls)
            .filter((s) => !existingIds.has(s.id))
          setRecommendations(filtered.slice(0, 15))
        }
      } catch (err) {
        console.error("Failed to load fallback recommendations:", err)
      } finally {
        setRecsLoading(false)
      }
    },
    [api, user?.userid, setRecommendations]
  )

  useEffect(() => {
    if (recsLockedSongId) return

    const activeSongId = currentQueueItem?.song?.id || currentSong?.id
    if (activeSongId) {
      if (activeSongId !== lastRecsSongIdRef.current) {
        fetchRecs(activeSongId)
      }
    } else {
      fetchSmartFallbackRecs()
    }
  }, [
    currentQueueItem?.song?.id,
    currentSong?.id,
    recsLockedSongId,
    fetchRecs,
    fetchSmartFallbackRecs,
  ])

  const handleClose = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: false })
  }, [])

  const handleRemove = useCallback(
    (queueItemId: string) => removeFromQueue(queueItemId),
    [removeFromQueue]
  )

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
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
    (song: Song) => {
      addToQueue(song)
      setRecommendations((prev) => prev.filter((s) => s.id !== song.id))
    },
    [addToQueue, setRecommendations]
  )

  const handlePlayNow = useCallback((song: Song) => playNow(song), [playNow])

  const handlePlayNext = useCallback((song: Song) => playNext(song), [playNext])

  const currentArtist = currentSong?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

  const renderQueueItem = useCallback(
    ({ item }: { item: QueueItem }) => (
      <QueueItemRow item={item} onRemove={handleRemove} colors={colors} />
    ),
    [handleRemove, colors]
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
    [handleAddToQueue, handlePlayNow, handlePlayNext, colors]
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
    { key: "playlists", label: "Playlists", icon: "disc" },
    { key: "recommended", label: "For You", icon: "zap" },
  ]

  const listBottomInset = Math.max(insets.bottom, 12) + 16

  return (
    <SwipeableModal
      isVisible={isQueueOpen}
      onClose={handleClose}
      maxHeight="100%"
      scrollable={true}
      scrollOffset={scrollOffset}
      hideHandle={true}
      fullScreen
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: 16 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.backButton, { backgroundColor: colors.secondary }]}
              accessibilityRole="button"
              accessibilityLabel="Close queue"
            >
              <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Queue</Text>
            {upcomingQueue.length > 0 && (
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                {upcomingQueue.length} next
              </Text>
            )}
          </View>
        </View>

        {/* Search Bar Input */}
        <View style={styles.searchBarContainer}>
          <Input
            ref={inputRef}
            placeholder="Search songs to add..."
            value={searchQuery}
            onChangeText={handleSearch}
            variant="filled"
            size="sm"
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

        {/* Tabs */}
        {!searchQuery.trim() && (
          <View style={[styles.tabBar, { backgroundColor: colors.secondary }]}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    setActiveTab(tab.key)
                    scrollOffset.value = 0
                  }}
                  style={[
                    styles.tab,
                    active && [styles.tabActive, { backgroundColor: colors.card }],
                  ]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={15}
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
        )}

        {/* Search View when query entered */}
        {searchQuery.trim() ? (
          <View style={styles.flex}>
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
                  <View style={styles.centeredState}>
                    <Feather name="search" size={28} color={colors.mutedForeground + "40"} />
                    <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                      No results found
                    </Text>
                  </View>
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: listBottomInset }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
            )}
          </View>
        ) : (
          /* Tab Content */
          <View style={styles.flex}>
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
                  </View>
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: listBottomInset }]}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
            )}

            {activeTab === "playlists" && (
              <PlaylistBrowser
                onPlayNow={handlePlayNow}
                onPlayNext={handlePlayNext}
                onAddToQueue={handleAddToQueue}
                onAddAll={addPlaylistToQueue}
                colors={colors}
              />
            )}

            {activeTab === "recommended" && (
              <View style={styles.flex}>
                {recsLoading ? (
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
                    ListHeaderComponent={
                      recsSourceName ? (
                        <View style={styles.recsHeaderRow}>
                          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                            {`BASED ON: ${recsSourceName.toUpperCase()}`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              const activeSongId = currentQueueItem?.song?.id || currentSong?.id
                              if (activeSongId) {
                                fetchRecs(activeSongId, true)
                              } else {
                                fetchSmartFallbackRecs(true)
                              }
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </View>
                      ) : null
                    }
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
                    contentContainerStyle={[styles.listContent, { paddingBottom: listBottomInset }]}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </SwipeableModal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  listHeader: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  countText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 8,
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    minHeight: 38,
    borderRadius: 9,
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
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
  },
  recsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playlistDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  addAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addAllBtnText: {
    fontSize: 12,
    fontWeight: "600",
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
