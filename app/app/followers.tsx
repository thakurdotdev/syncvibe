import { useUser } from '@/context/UserContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { useRouter } from 'expo-router';
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
import { useTheme } from '@/context/ThemeContext';
import Card from '@/components/ui/card';
import { Ionicons } from '@expo/vector-icons';

interface FollowerDetail {
  id: number;
  name: string;
  username: string;
  profilepic: string;
}

export interface followersType {
  id: number;
  followerDetail: FollowerDetail;
}

const Followers = () => {
  const { followers, fetchFollowData } = useUser();
  const { colors } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchFollowData();
    setRefreshing(false);
  }, [fetchFollowData]);

  const renderFollower = ({ item: follow }: { item: any }) => (
    <Card variant='default' style={styles.followerCard}>
      <TouchableOpacity
        style={styles.followerItem}
        onPress={() => router.push(`/profile/${follow.followerDetail.username}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
          {follow.followerDetail.profilepic ? (
            <Image
              source={{
                uri: getProfileCloudinaryUrl(follow.followerDetail.profilepic),
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.muted }]}>
              <Text style={[styles.avatarFallbackText, { color: colors.mutedForeground }]}>
                {follow.followerDetail.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
            {follow.followerDetail.name}
          </Text>
          <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{follow.followerDetail.username}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.messageButton, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/messages/${follow.followerDetail.username}`)}
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
      <Text style={[styles.emptyTextTitle, { color: colors.foreground }]}>No Followers Yet</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        When people follow you, they'll appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={followers}
        renderItem={renderFollower}
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
  followerCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  followerItem: {
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

export default Followers;
