import { Ionicons } from '@expo/vector-icons';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
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
import useApi from '@/utils/hooks/useApi';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import LoginScreen from '@/components/LoginScreen';
import ChatSearchBar from '@/components/chat/ChatSearchBar';
import ChatListItem from '@/components/chat/ChatListItem';
import { TabHeader } from '@/components/ui/AppHeader';
import { loadThread, openConversationWith, refreshConversations } from '@/lib/chat';
import { openConversation } from '@/lib/chatScreen';
import { previewOf, useChatStore, type Conversation } from '@/stores/chatStore';

interface SearchUser {
  userid: number;
  name: string;
  profilepic?: string;
}

const SEARCH_DELAY_MS = 400;

const ChatListScreen: React.FC = () => {
  const { user } = useUser();
  const api = useApi();
  const { colors } = useTheme();

  const meId = useChatStore((s) => s.meId);
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const presence = useChatStore((s) => s.presence);
  const typing = useChatStore((s) => s.typing);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const term = searchQuery.trim();

  const changeQuery = useCallback((value: string) => {
    setSearchQuery(value);
    setSearching(Boolean(value.trim()));
  }, []);

  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/api/user/search', { params: { name: term } });
        if (!cancelled) setSearchResults(response.data.users || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, api]);

  const startWith = useCallback(
    async (person: SearchUser) => {
      try {
        const conversation = await openConversationWith(person.userid);
        changeQuery('');
        Keyboard.dismiss();
        openConversation(conversation.id);
      } catch {
        toast(`Couldn't open a chat with ${person.name}`, { type: 'error' });
      }
    },
    [changeQuery]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, []);

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => (
      <ChatListItem
        user={item.peer}
        lastMessage={previewOf(item.lastMessage, meId)}
        updatedAt={item.lastMessageAt ?? undefined}
        isOnline={Boolean(presence[item.peer.userid])}
        isTyping={Boolean(typing[item.id])}
        unreadCount={item.unreadCount}
        onPress={() => openConversation(item.id)}
        // Starts loading the messages while the finger is still down.
        onPressIn={() => void loadThread(item.id)}
      />
    ),
    [meId, presence, typing]
  );

  const renderPerson = useCallback(
    ({ item }: { item: SearchUser }) => (
      <ChatListItem user={item} isSearchResult onPress={() => startWith(item)} />
    ),
    [startWith]
  );

  const empty = (
    <View style={styles.emptyContainer}>
      {(term ? searching : !loaded) ? (
        <ActivityIndicator size='small' color={colors.primary} />
      ) : (
        <>
          <Ionicons name='chatbubble-ellipses-outline' size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            {term ? 'No one found' : 'No conversations yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {term ? 'Try a different name' : 'Search for someone to start messaging'}
          </Text>
        </>
      )}
    </View>
  );

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <TabSafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <TabHeader title='Messages' showSearch={false} />

      <ChatSearchBar
        value={searchQuery}
        onChangeText={changeQuery}
        onClear={() => {
          changeQuery('');
          Keyboard.dismiss();
        }}
        inputRef={inputRef}
      />

      {term ? (
        <FlatList
          data={searching ? [] : searchResults}
          keyExtractor={(item) => `person-${item.userid}`}
          renderItem={renderPerson}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => `conversation-${item.id}`}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={empty}
          initialNumToRender={12}
          windowSize={10}
        />
      )}
    </TabSafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: DECK_CLEARANCE, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 13, marginTop: 8, textAlign: 'center', maxWidth: '80%' },
});

export default ChatListScreen;
