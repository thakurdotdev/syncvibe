import Avatar from '@/components/chat/Avatar';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { loadStarred, setMessageStarred } from '@/lib/chat';
import { openConversation } from '@/lib/chatScreen';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { previewOf, useChatStore, type ChatMessage } from '@/stores/chatStore';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** Messages you starred, from every chat, the latest starred first. Tap one to go to it. */
export default function StarredScreen() {
  const { colors } = useTheme();
  const meId = useChatStore((s) => s.meId);
  const conversations = useChatStore((s) => s.conversations);
  const starred = useChatStore((s) => s.starred);
  const {
    data: messages,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['chat', 'starred'],
    queryFn: loadStarred,
  });
  const failed = isError;

  // Unstarred here or on another device: it leaves the list straight away.
  const shown = messages?.filter((m) => m.id != null && starred[m.id]) ?? null;

  const open = (message: ChatMessage) => {
    useChatStore.getState().requestJump(message.conversationId, message.id!);
    openConversation(message.conversationId);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const conversation = conversations.find((c) => c.id === item.conversationId);
    const peerName = conversation?.peer.name ?? 'Chat';
    const fromMe = item.senderId === meId;
    return (
      <PressableScale
        onPress={() => open(item)}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityHint='Opens the chat at this message'
        style={styles.row}
      >
        <Avatar name={peerName} profilepic={conversation?.peer.profilepic ?? undefined} size='sm' />
        <View style={styles.rowText}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {fromMe ? `You → ${peerName}` : peerName}
            </Text>
            <Text style={[styles.when, { color: colors.mutedForeground }]}>
              {formatWhen(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={2}>
            {previewOf(item, null)}
          </Text>
        </View>
        <PressableScale
          onPress={() =>
            setMessageStarred(item, false).catch(() =>
              toast("Couldn't unstar it. Try again.", { type: 'error' })
            )
          }
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={10}
          accessibilityRole='button'
          accessibilityLabel='Unstar'
        >
          <Ionicons name='star' size={18} color={colors.foreground} />
        </PressableScale>
      </PressableScale>
    );
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StackHeader title='Starred messages' />
      {shown == null && !failed ? (
        <ActivityIndicator style={styles.center} color={colors.mutedForeground} />
      ) : failed && !shown ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Couldn't load starred messages
          </Text>
          <PressableScale
            onPress={() => void refetch()}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            style={[styles.retry, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <FlatList
          data={shown ?? []}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: DECK_CLEARANCE }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.mutedForeground}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name='star-outline' size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No starred messages
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Hold a message and tap Star to find it here later.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 80 },
  list: { paddingTop: 8, paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  when: { fontSize: 12, fontVariant: ['tabular-nums'] },
  preview: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retry: {
    marginTop: 8,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontWeight: '600' },
});
