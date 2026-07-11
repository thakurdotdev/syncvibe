import { usePlaylistState } from "@/stores/playerStore"
import { Song } from "@/types/song"
import useApi from "@/utils/hooks/useApi"
import { useTheme } from "@/context/ThemeContext"
import { MaterialIcons } from "@expo/vector-icons"
import React, { useState, useEffect, useRef } from "react"
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import SwipeableModal from "../common/SwipeableModal"

export interface Playlist {
  id: string
  name: string
  image?: any[]
  songCount: number
}

interface AddToPlaylistProps {
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  song: Song | undefined
}

const AddToPlaylist: React.FC<AddToPlaylistProps> = ({ dialogOpen, setDialogOpen, song }) => {
  const { colors } = useTheme()
  const { userPlaylist, setUserPlaylist } = usePlaylistState()
  const api = useApi()

  const [newPlaylistDialog, setNewPlaylistDialog] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [loading, setLoading] = useState(false)
  const [addingSong, setAddingSong] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [addingSuccess, setAddingSuccess] = useState(false)

  const successOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!dialogOpen) {
      setSearchQuery("")
      setSelectedPlaylistId(null)
      setAddingSuccess(false)
    }
  }, [dialogOpen])

  useEffect(() => {
    if (addingSuccess) {
      Animated.sequence([
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setDialogOpen(false)
        setAddingSuccess(false)
        setSelectedPlaylistId(null)
      })
    } else {
      successOpacity.setValue(0)
    }
  }, [addingSuccess])

  const getPlaylists = async () => {
    try {
      const { data } = await api.get("/api/playlist/get")
      if (data?.data) setUserPlaylist(data.data)
    } catch (error) {
      console.error("Error fetching playlists:", error)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    setLoading(true)
    try {
      const response = await api.post(
        `/api/playlist/create`,
        { name: newPlaylistName },
        { withCredentials: true },
      )
      if (response.status === 200) {
        await getPlaylists()
        setNewPlaylistDialog(false)
        setNewPlaylistName("")
      }
    } catch (error: any) {
      Alert.alert(error.response?.data.message || "Failed to create playlist")
    } finally {
      setLoading(false)
    }
  }

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!playlistId || !song || addingSong) return
    setSelectedPlaylistId(playlistId)
    setAddingSong(true)
    try {
      const response = await api.post(
        `/api/playlist/add-song`,
        { playlistId, songId: song.id, songData: JSON.stringify(song) },
        { withCredentials: true },
      )
      if (response.status === 201) {
        setAddingSuccess(true)
        await getPlaylists()
      }
    } catch (error: any) {
      Alert.alert(error.response?.data.message || "Failed to add song to playlist")
      setSelectedPlaylistId(null)
    } finally {
      setAddingSong(false)
    }
  }

  const getImageUrl = (images: any[]) => {
    if (images && images.length > 0) return images[1]?.link || images[0]?.link
    return ""
  }

  const filteredPlaylists = userPlaylist.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const renderPlaylistItem = ({ item }: { item: Playlist }) => {
    const isSelected = selectedPlaylistId === item.id
    const isDisabled = addingSong && !isSelected

    return (
      <TouchableOpacity
        onPress={() => !addingSong && handleAddToPlaylist(item.id)}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isSelected ? colors.accent : colors.secondary,
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            borderWidth: isSelected ? 1 : 0,
            borderColor: isSelected ? colors.primary : "transparent",
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <Image
          source={
            item.image && getImageUrl(item.image)
              ? { uri: getImageUrl(item.image) }
              : require("../../assets/icon.jpg")
          }
          style={{ width: 48, height: 48, borderRadius: 8, marginRight: 14 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
            {item.songCount || 0} {item.songCount === 1 ? "song" : "songs"}
          </Text>
        </View>
        {isSelected && (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: addingSuccess ? colors.primary : colors.primary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {addingSuccess ? (
              <Animated.View style={{ opacity: successOpacity }}>
                <MaterialIcons name="check" size={18} color={colors.primaryForeground} />
              </Animated.View>
            ) : (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            )}
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <SwipeableModal
        isVisible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        backdropOpacity={0.6}
        scrollable={true}
        useScrollView={false}
        maxHeight="90%"
      >
        <View style={{ padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
              paddingHorizontal: 4,
            }}
          >
            <MaterialIcons name="playlist-add" size={22} color={colors.primary} />
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontWeight: "700",
                marginLeft: 10,
                flex: 1,
                letterSpacing: -0.3,
              }}
            >
              Add to Playlist
            </Text>
            <TouchableOpacity
              onPress={() => setDialogOpen(false)}
              style={{
                padding: 6,
                borderRadius: 20,
                backgroundColor: colors.secondary,
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.secondary,
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 14,
              height: 46,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MaterialIcons
              name="search"
              size={18}
              color={colors.mutedForeground}
              style={{ marginRight: 8 }}
            />
            <TextInput
              placeholder="Search playlists..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, color: colors.foreground, fontSize: 15, height: 46 }}
              selectionColor={colors.primary}
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 13,
              marginBottom: 18,
            }}
            onPress={() => setNewPlaylistDialog(true)}
            disabled={loading}
            activeOpacity={0.75}
          >
            <MaterialIcons name="add" size={20} color={colors.primaryForeground} />
            <Text
              style={{
                color: colors.primaryForeground,
                fontWeight: "600",
                marginLeft: 8,
                fontSize: 15,
              }}
            >
              New Playlist
            </Text>
          </TouchableOpacity>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                Loading playlists…
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredPlaylists}
              renderItem={renderPlaylistItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
                  <MaterialIcons name="queue-music" size={44} color={colors.border} />
                  <Text
                    style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 14 }}
                  >
                    {searchQuery
                      ? "No matching playlists found"
                      : "No playlists yet. Create one to get started!"}
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
            />
          )}
        </View>
      </SwipeableModal>

      <SwipeableModal
        isVisible={newPlaylistDialog}
        onClose={() => setNewPlaylistDialog(false)}
        backdropOpacity={0.5}
        maxHeight="auto"
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 18,
              letterSpacing: -0.3,
            }}
          >
            New Playlist
          </Text>

          <TextInput
            placeholder="Playlist name"
            placeholderTextColor={colors.mutedForeground}
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            style={{
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderRadius: 12,
              padding: 14,
              marginBottom: 18,
              fontSize: 15,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            autoFocus
            selectionColor={colors.primary}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.secondary,
                borderRadius: 12,
                padding: 13,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={() => {
                setNewPlaylistDialog(false)
                setNewPlaylistName("")
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 13,
                alignItems: "center",
                opacity: !newPlaylistName.trim() || loading ? 0.5 : 1,
              }}
              onPress={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || loading}
              activeOpacity={0.75}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SwipeableModal>
    </>
  )
}

export default AddToPlaylist
