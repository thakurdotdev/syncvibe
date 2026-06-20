import React from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/context/UserContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import Card from '@/components/ui/card';

interface FollowingDetail {
  userid: number;
  name: string;
  username: string;
  profilepic: string;
}

export interface followingType {
  id: number;
  followingDetail: FollowingDetail;
}

const Followings = () => {
  const router = useRouter();
  const { following, fetchFollowData } = useUser();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchFollowData();
    setRefreshing(false);
  }, [fetchFollowData]);

  const renderFollowing = ({ item: follow }: { item: any }) => (
    <Card variant='default' style={styles.followingCard}>
      <TouchableOpacity
        style={styles.followingItem}
        onPress={() => router.push(`/profile/${follow.followingDetail.username}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
          {follow.followingDetail.profilepic ? (
            <Image
              source={{
                uri: getProfileCloudinaryUrl(follow.followingDetail.profilepic),
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.muted }]}>
              <Text style={[styles.avatarFallbackText, { color: colors.mutedForeground }]}>
                {follow.followingDetail.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
            {follow.followingDetail.name}
          </Text>
          <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{follow.followingDetail.username}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.messageButton, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/messages/${follow.followingDetail.username}`)}
          activeOpacity={0.7}
        >
          <Ionicons name='paper-plane-outline' size={18} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Card>
  );

  const ListEmptyComponent = () => (
    <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
      <Ionicons name='people-outline' size={40} color={colors.mutedForeground} />
      <Text style={[styles.emptyTextTitle, { color: colors.foreground }]}>No Following</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        When you follow people, they'll appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={following}
        renderItem={renderFollowing}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    padding: 12,
  },
  followingCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  avatarContainer: {
    height: 44,
    width: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontWeight: '600',
    fontSize: 14,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1,
  },
  userHandle: {
    fontSize: 13,
  },
  messageButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTextTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});

export default Followings;
