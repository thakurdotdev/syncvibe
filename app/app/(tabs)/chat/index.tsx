import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useChat } from '@/context/SocketContext';
import useApi from '@/utils/hooks/useApi';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import LoginScreen from '@/components/LoginScreen';
import ChatSearchBar from '@/components/chat/ChatSearchBar';
import ChatListItem from '@/components/chat/ChatListItem';

interface SearchUser {
  userid: string;
  name: string;
  profilepic?: string;
}

const ChatListScreen: React.FC = () => {
  const { user } = useUser();
  const api = useApi();
  const { colors } = useTheme();
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
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

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

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await getAllExistingChats();
    setRefreshing(false);
  }, [getAllExistingChats]);

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

  const isSearching = searchResults.length > 0;

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (isSearching) {
        return (
          <ChatListItem user={item} isSearchResult onPress={() => handleUserSelect(item, true)} />
        );
      }

      const otherUser = item.otherUser;
      return (
        <ChatListItem
          user={otherUser}
          lastMessage={item.lastmessage}
          updatedAt={item.updatedat}
          isOnline={onlineStatuses[otherUser?.userid]}
          isTyping={item.isTyping}
          onPress={() => handleUserSelect(item)}
        />
      );
    },
    [isSearching, handleUserSelect, onlineStatuses]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name='chatbubble-ellipses-outline' size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
          {searchQuery.length > 0 ? 'No users found' : 'No conversations yet'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          {searchQuery.length > 0
            ? 'Try a different search term'
            : 'Search for users to start messaging'}
        </Text>
      </View>
    ),
    [colors, searchQuery]
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
          {isSearching ? `Search Results (${searchResults.length})` : 'Recent Conversations'}
        </Text>
      </View>
    ),
    [colors, isSearching, searchResults.length]
  );

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <TabSafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Messages</Text>
      </View>

      <ChatSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={clearSearch}
        inputRef={inputRef}
      />

      {loading && (
        <View pointerEvents='none' style={styles.loadingOverlay}>
          <ActivityIndicator size='small' color={colors.primary} />
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={isSearching ? searchResults : users}
        keyExtractor={(item, index) =>
          isSearching
            ? `search-${item.userid}-${index}`
            : `chat-${item?.otherUser?.userid}-${index}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={renderHeader}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </TabSafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 42,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '80%',
  },
});

export default ChatListScreen;
