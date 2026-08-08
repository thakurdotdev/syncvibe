import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Feather, Ionicons } from "@expo/vector-icons"
import SwipeableModal from "@/components/SwipeableModal"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/context/ThemeContext"
import { useChat } from "@/context/SocketContext"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"
import useApi from "@/utils/hooks/useApi"
import { useSharedValue } from "react-native-reanimated"

interface InviteUser {
  userid: number
  name: string
  username: string
  profilepic: string
  isFollowing?: boolean
}

const UserRow = React.memo(
  ({
    user,
    isOnline,
    isInvited,
    isInGroup,
    onInvite,
    colors,
  }: {
    user: InviteUser
    isOnline: boolean
    isInvited: boolean
    isInGroup: boolean
    onInvite: (userId: number) => void
    colors: any
  }) => {
    return (
      <View style={[styles.userRow, { borderBottomColor: colors.border + "30" }]}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: getProfileCloudinaryUrl(user.profilepic) || "https://via.placeholder.com/40",
            }}
            style={[styles.avatar, { backgroundColor: colors.secondary }]}
          />
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: isOnline ? "#10b981" : colors.mutedForeground + "40" },
              { borderColor: colors.card },
            ]}
          />
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {user.name}
            </Text>
            {user.isFollowing && (
              <View style={[styles.followBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.followBadgeText, { color: colors.primary }]}>Following</Text>
              </View>
            )}
          </View>
          <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{user.username}
            {isOnline && <Text style={{ color: "#10b981", fontWeight: "700" }}> · online</Text>}
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {isInGroup ? (
            <View style={[styles.statusBadge, { borderColor: colors.border }]}>
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>In group</Text>
            </View>
          ) : isInvited ? (
            <View style={[styles.sentBadge, { backgroundColor: "#10b981" + "15" }]}>
              <Feather name="check" size={12} color="#10b981" />
              <Text style={styles.sentText}>Sent</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => onInvite(user.userid)}
              style={[styles.inviteButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.inviteButtonText, { color: colors.primaryForeground }]}>
                Invite
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }
)

interface InviteSheetProps {
  isOpen: boolean
  onClose: () => void
}

export const InviteSheet: React.FC<InviteSheetProps> = ({ isOpen, onClose }) => {
  const { colors } = useTheme()
  const { onlineStatuses } = useChat()
  const { sendInvite } = useGroupMusic()
  const api = useApi()
  const inputRef = useRef<TextInput>(null)
  const insets = useSafeAreaInsets()

  const groupMembers = useGroupSessionStore((s) => s.groupMembers)
  const memberIds = useMemo(() => new Set(groupMembers?.map((m) => m.userId) || []), [groupMembers])

  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<InviteUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [invitedUsers, setInvitedUsers] = useState<Set<number>>(new Set())
  const [hasSearched, setHasSearched] = useState(false)
  const searchTimer = useRef<any>(null)
  const scrollOffset = useSharedValue(0)

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y
    },
    [scrollOffset]
  )

  const fetchUsers = useCallback(
    async (query: string) => {
      try {
        setIsLoading(true)
        const params = query?.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""
        const response = await api.get(`/api/user/invite-list${params}`)
        setUsers(response.data?.users || [])
        setHasSearched(true)
      } catch {
        setUsers([])
      } finally {
        setIsLoading(false)
      }
    },
    [api]
  )

  useEffect(() => {
    if (isOpen) {
      fetchUsers("")
      setInvitedUsers(new Set())
      setSearchQuery("")
      setHasSearched(false)
      scrollOffset.value = 0
      const timer = setTimeout(() => inputRef.current?.focus(), 350)
      return () => clearTimeout(timer)
    }
  }, [isOpen, fetchUsers])

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(() => fetchUsers(query), 400)
    },
    [fetchUsers]
  )

  const handleInvite = useCallback(
    (userId: number) => {
      setInvitedUsers((prev) => new Set(prev).add(userId))
      sendInvite(userId)
    },
    [sendInvite]
  )

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aOnline = onlineStatuses?.[a.userid] ? 1 : 0
      const bOnline = onlineStatuses?.[b.userid] ? 1 : 0
      const aFollow = a.isFollowing ? 1 : 0
      const bFollow = b.isFollowing ? 1 : 0
      if (aFollow !== bFollow) return bFollow - aFollow
      if (aOnline !== bOnline) return bOnline - aOnline
      return 0
    })
  }, [users, onlineStatuses])

  const renderItem = useCallback(
    ({ item }: { item: InviteUser }) => (
      <UserRow
        user={item}
        isOnline={!!onlineStatuses?.[item.userid]}
        isInvited={invitedUsers.has(item.userid)}
        isInGroup={memberIds.has(item.userid)}
        onInvite={handleInvite}
        colors={colors}
      />
    ),
    [onlineStatuses, invitedUsers, memberIds, handleInvite, colors]
  )

  const keyExtractor = useCallback((item: InviteUser) => String(item.userid), [])

  const statusBarHeight = Platform.OS === "android" ? StatusBar.currentHeight || 24 : insets.top
  const topPadding = Math.max(statusBarHeight, insets.top || 0, 24)

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight="100%"
      scrollable={true}
      scrollOffset={scrollOffset}
      hideHandle={true}
      fullScreen
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: 16 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Invite Friends</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                Bring your circle into the sync
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Input
            ref={inputRef}
            placeholder="Search friends..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            variant="filled"
            size="sm"
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

        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sortedUsers}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.centeredState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                  <Feather
                    name={hasSearched ? "user-plus" : "users"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {hasSearched ? "No results" : "No friends yet"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {hasSearched
                    ? "Try a different name or username"
                    : "Search by name to invite someone"}
                </Text>
              </View>
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backButton: {
    paddingRight: 4,
    paddingTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  searchInput: {
    flex: 1,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
  },
  followBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  followBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  userHandle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionContainer: {
    marginLeft: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  sentText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
  },
  inviteButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
})
