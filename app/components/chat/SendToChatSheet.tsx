import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { refreshConversations } from '@/lib/chat';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { useChatStore, type Conversation } from '@/stores/chatStore';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Avatar from './Avatar';

interface SendToChatSheetProps {
  isVisible: boolean;
  onClose: () => void;
  /** "Send to…", "Forward to…" */
  title: string;
  /** What is being sent, under the title. */
  subtitle?: string;
  onPick: (conversation: Conversation) => void;
  /** Left out of the list: the conversation a message is forwarded from. */
  excludeId?: number | null;
}

/** Picks one of your conversations, for a song or a message to go to. */
const SendToChatSheet: React.FC<SendToChatSheetProps> = ({
  isVisible,
  onClose,
  title,
  subtitle,
  onPick,
  excludeId,
}) => {
  const { colors } = useTheme();
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isVisible) void refreshConversations();
  }, [isVisible]);

  // The search starts empty the next time it opens.
  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (conversation: Conversation) => {
    setQuery('');
    onPick(conversation);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        c.id !== excludeId &&
        !c.blocked &&
        (!q || c.peer.name.toLowerCase().includes(q) || c.peer.username?.toLowerCase().includes(q))
    );
  }, [conversations, query, excludeId]);

  return (
    <SwipeableModal
      isVisible={isVisible}
      onClose={close}
      maxHeight={Dimensions.get('window').height * 0.72}
      style={{ height: Dimensions.get('window').height * 0.72 }}
    >
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        <View style={[styles.search, { backgroundColor: colors.raised }]}>
          <Feather name='search' size={15} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Search your chats'
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize='none'
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {!loaded && conversations.length === 0 ? (
          <ActivityIndicator style={styles.empty} color={colors.mutedForeground} />
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(c) => String(c.id)}
            keyboardShouldPersistTaps='handled'
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {query.trim()
                  ? `No chats match "${query.trim()}"`
                  : 'Start a chat from the Messages tab first.'}
              </Text>
            }
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => pick(item)}
                scaleTo={ROW_PRESS_SCALE}
                accessibilityRole='button'
                accessibilityLabel={`${title} ${item.peer.name}`}
                style={styles.row}
              >
                <Avatar
                  name={item.peer.name}
                  profilepic={item.peer.profilepic ?? undefined}
                  size='sm'
                />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {item.peer.name}
                  </Text>
                  {item.peer.username ? (
                    <Text
                      style={[styles.handle, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      @{item.peer.username}
                    </Text>
                  ) : null}
                </View>
                <Feather name='send' size={17} color={colors.mutedForeground} />
              </PressableScale>
            )}
          />
        )}
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  title: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20 },
  subtitle: { fontSize: 13, marginTop: 2, paddingHorizontal: 20 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 13, marginTop: 1 },
  empty: { marginTop: 40 },
  emptyText: { textAlign: 'center', fontSize: 14, marginTop: 40, paddingHorizontal: 24 },
});

export default SendToChatSheet;
