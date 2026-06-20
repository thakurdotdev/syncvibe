import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useChat } from '@/context/SocketContext';
import useApi from '@/utils/hooks/useApi';
import { useDebounce } from '@/utils/hooks/useDebounce';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { TimeAgo } from '@/utils/TimeAgo';
import LoginScreen from '@/components/LoginScreen';
import Card from '@/components/ui/card';

const AVATAR_SIZE = 40;
const ONLINE_INDICATOR_SIZE = 10;

interface User {
  userid: string;
  name: string;
  profilepic?: string;
  isTyping?: boolean;
  lastmessage?: string;
  updatedat?: string;
}

const SearchUser: React.FC = () => {
  const { user } = useUser();
  const api = useApi();
  const { colors, theme } = useTheme();
  const {
    users,
    loading,
    setLoading,
    setCurrentChat,
    getAllExistingChats,
    socket,
    onlineStatuses,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  // Search functionality
  const searchUsers = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/api/user/search?name=${query}`);
        setSearchResults(response.data.users || []);
      } catch (error: any) {
        setSearchResults([]);
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading]
  );

  // Make sure debouncedSearch is properly memoized
  const debouncedSearch = useCallback(
    useDebounce((query: string) => searchUsers(query), 400),
    [searchUsers]
  );

  useEffect(() => {
    // Only run this effect when searchQuery changes
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Chat actions
  const createChat = useCallback(
    async (userid: string) => {
      try {
        setLoading(true);
        const response = await api.post(`/api/create/chat`, {
          recieverid: userid,
        });

        if (response.status === 200) {
          setCurrentChat(response.data.chat);
          socket?.emit('join-room', response.data.chat.chatid);
          await getAllExistingChats();
          setSearchResults([]);
          setSearchQuery('');
          Keyboard.dismiss();
          router.push('/message');
        }
      } catch (error) {
        console.error('Create chat error:', error);
      } finally {
        setLoading(false);
      }
    },
    [api, setLoading, setCurrentChat, socket, getAllExistingChats]
  );

  const handleUserSelect = useCallback(
    (item: any, isSearchResult = false) => {
      if (isSearchResult) {
        createChat(item.userid);
      } else {
        setCurrentChat(item);
        router.push('/message');
      }
    },
    [createChat, setCurrentChat]
  );

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    setTimeout(() => {
      // This is a hack to force a re-render
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 50);
    }, 50);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await getAllExistingChats();
    setRefreshing(false);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery, searchUsers]);

  const renderUserItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isSearchResult = searchResults.length > 0;
      const user = isSearchResult ? item : item.otherUser;
      const isOnline = isSearchResult ? false : onlineStatuses[user?.userid];
      const isTyping = !isSearchResult && item.isTyping;

      return (
        <TouchableOpacity
          onPress={() => handleUserSelect(item, isSearchResult)}
          activeOpacity={0.7}
          style={{ marginVertical: 4 }}
        >
          <Card variant='ghost' className='flex-row items-center p-3'>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: getProfileCloudinaryUrl(user?.profilepic) }}
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.muted,
                    borderWidth: 2,
                    borderColor: isOnline ? colors.primary : colors.muted,
                  },
                ]}
              />
              {isOnline && (
                <View
                  style={[
                    styles.onlineIndicator,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.background,
                    },
                  ]}
                />
              )}
            </View>

            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {user?.name}
              </Text>

              {!isSearchResult &&
                (isTyping ? (
                  <View style={styles.typingContainer}>
                    <Text style={[styles.typingText, { color: colors.primary }]}>typing...</Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.lastMessage, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {item?.lastmessage || ''}
                  </Text>
                ))}
            </View>

            {!isSearchResult && (
              <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                {item?.updatedat ? TimeAgo(item.updatedat) : ''}
              </Text>
            )}
          </Card>
        </TouchableOpacity>
      );
    },
    [handleUserSelect, onlineStatuses, searchResults]
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name='chatbubble-ellipses-outline' size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {searchQuery.length > 0 ? 'No users found' : 'No conversations yet'}
      </Text>
      <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
        {searchQuery.length > 0
          ? 'Try a different search term'
          : 'Search for users to start messaging'}
      </Text>
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
        {searchResults.length > 0
          ? `Search Results (${searchResults.length})`
          : 'Recent Conversations'}
      </Text>
    </View>
  );

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
      </View>

      <View style={styles.searchBarWrapper}>
        <BlurView
          intensity={20}
          tint={theme === 'dark' ? 'dark' : 'light'}
          style={styles.searchBarBlur}
        >
          <View
            style={[styles.searchContainer, { backgroundColor: colors.muted }]}
            className='rounded-full'
          >
            <Ionicons
              name='search'
              size={18}
              color={colors.mutedForeground}
              style={styles.searchIcon}
            />
            <TextInput
              ref={inputRef}
              placeholder='Search for users...'
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
              placeholderTextColor={colors.mutedForeground}
              returnKeyType='search'
              autoCapitalize='none'
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name='close-circle' size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='small' color={colors.primary} />
        </View>
      )}

      <View style={styles.listContainer}>
        <FlatList
          key={searchResults.length > 0 ? 'search' : 'users'}
          ref={flatListRef}
          data={searchResults.length > 0 ? searchResults : users}
          keyExtractor={(item, index) =>
            searchResults.length > 0
              ? `search-${item.userid}-${index}`
              : `chat-${item?.otherUser?.userid}-${index}`
          }
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={renderEmptyList}
          ListHeaderComponent={renderListHeader}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor value is applied dynamically through style prop
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    // color value is applied dynamically through style prop
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBarBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    // color value is applied dynamically through style prop
    height: 42,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    marginBottom: 26,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  listHeaderContainer: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    // color value is applied dynamically through style prop
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor value is applied dynamically through style prop
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  userCardOnline: {
    borderLeftWidth: 2,
    // borderLeftColor value is applied dynamically through style prop
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    // backgroundColor value is applied dynamically through style prop
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: ONLINE_INDICATOR_SIZE,
    height: ONLINE_INDICATOR_SIZE,
    borderRadius: ONLINE_INDICATOR_SIZE / 2,
    // backgroundColor and borderColor values are applied dynamically through style prop
    borderWidth: 1.5,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    // color value is applied dynamically through style prop
    marginBottom: 2,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 13,
    // color value is applied dynamically through style prop
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 13,
    // color value is applied dynamically through style prop
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    // color value is applied dynamically through style prop
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 13,
    // color value is applied dynamically through style prop
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '80%',
  },
  timeText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '400',
    alignSelf: 'flex-start',
  },
});

export default SearchUser;
