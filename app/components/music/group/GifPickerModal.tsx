import React, { useCallback, useEffect, useRef, useState } from "react"
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
} from "react-native"
import { Feather } from "@expo/vector-icons"
import SwipeableModal from "@/components/SwipeableModal"
import { useTheme } from "@/context/ThemeContext"

const GIPHY_KEY = "fNEK945T8rNeZZKqkghYw1zFKWV0Se1M"
const COLUMN_GAP = 6
const NUM_COLUMNS = 2

interface GiphyImage {
  url: string
  width: string
  height: string
}

interface GiphyGif {
  id: string
  title: string
  images: {
    fixed_width_still: GiphyImage
    fixed_width: GiphyImage
    original: GiphyImage
  }
}

interface GifPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (gifUrl: string) => void
}

const GifThumbnail = React.memo(
  ({
    gif,
    itemWidth,
    onSelect,
    colors,
  }: {
    gif: GiphyGif
    itemWidth: number
    onSelect: (url: string) => void
    colors: any
  }) => {
    const still = gif.images?.fixed_width_still?.url
    const animated = gif.images?.fixed_width?.url
    const full = gif.images?.original?.url || animated
    const aspectRatio =
      Number(gif.images?.fixed_width?.width) / Number(gif.images?.fixed_width?.height) || 1

    return (
      <TouchableOpacity
        onPress={() => onSelect(full)}
        activeOpacity={0.8}
        style={[thumbnailStyles.card, { width: itemWidth, backgroundColor: colors.secondary }]}
      >
        <Image
          source={{ uri: animated || still }}
          style={[thumbnailStyles.image, { width: itemWidth, aspectRatio }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    )
  },
)

const thumbnailStyles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: COLUMN_GAP,
  },
  image: {
    minHeight: 80,
    maxHeight: 200,
  },
})

export const GifPickerModal: React.FC<GifPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { colors } = useTheme()
  const [query, setQuery] = useState("")
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [trending, setTrending] = useState<GiphyGif[]>([])
  const [loading, setLoading] = useState(true)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const screenWidth = Dimensions.get("window").width
  const contentPadding = 16
  const itemWidth = (screenWidth - contentPadding * 2 - COLUMN_GAP) / NUM_COLUMNS

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=30&rating=g`)
      .then((r) => r.json())
      .then((d) => {
        setTrending(d.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isOpen])

  const handleSearch = useCallback((text: string) => {
    setQuery(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!text.trim()) {
      setGifs([])
      return
    }

    searchTimeout.current = setTimeout(() => {
      setLoading(true)
      fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(text)}&limit=30&rating=g`,
      )
        .then((r) => r.json())
        .then((d) => {
          setGifs(d.data || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, 350)
  }, [])

  const handleSelect = useCallback(
    (gifUrl: string) => {
      onSelect(gifUrl)
      onClose()
      setQuery("")
      setGifs([])
    },
    [onSelect, onClose],
  )

  const displayGifs = query.trim() ? gifs : trending

  const renderItem = useCallback(
    ({ item }: { item: GiphyGif }) => (
      <GifThumbnail gif={item} itemWidth={itemWidth} onSelect={handleSelect} colors={colors} />
    ),
    [itemWidth, handleSelect, colors],
  )

  const keyExtractor = useCallback((item: GiphyGif) => item.id, [])

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get("window").height * 0.7}
      style={{ height: Dimensions.get("window").height * 0.7 }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>GIFs</Text>
          <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
            Powered by GIPHY
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: "auto" }}
          >
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.secondary }]}>
          <Feather name="search" size={16} color={colors.mutedForeground + "80"} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search GIFs..."
            placeholderTextColor={colors.mutedForeground + "60"}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground + "60"} />
            </TouchableOpacity>
          )}
        </View>

        {/* Grid */}
        {loading && displayGifs.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : displayGifs.length === 0 ? (
          <View style={styles.centered}>
            <Feather name="image" size={28} color={colors.mutedForeground + "30"} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground + "60" }]}>
              {query.trim() ? "No GIFs found" : "Search for GIFs"}
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
            keyboardShouldPersistTaps="handled"
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  attribution: {
    fontSize: 10,
    fontWeight: "500",
    opacity: 0.6,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
  },
})
