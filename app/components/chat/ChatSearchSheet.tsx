import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { MIN_SEARCH_LENGTH, searchConversation } from '@/lib/chat';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { previewOf, type ChatMessage } from '@/stores/chatStore';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SEARCH_DELAY_MS = 350;
/** The sheet slides up first; the keyboard comes once it's there. */
const FOCUS_AFTER_MS = 280;

interface ChatSearchSheetProps {
  isVisible: boolean;
  onClose: () => void;
  conversationId: number | null;
  meId: number | null;
  peerName: string;
  /** A result was tapped: the chat goes to that message. */
  onPick: (message: ChatMessage) => void;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** The searched words, in bold, wherever they come in the text. */
const Highlighted = ({ text, query, color }: { text: string; query: string; color: string }) => {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1 && needle; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <Text key={at} style={[styles.match, { color }]}>
        {text.slice(at, at + needle.length)}
      </Text>
    );
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
};

/** Finds messages in this chat by their words or file names, and goes to the one tapped. */
const ChatSearchSheet: React.FC<ChatSearchSheetProps> = ({
  isVisible,
  onClose,
  conversationId,
  meId,
  peerName,
  onPick,
}) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const term = query.replace(/\s+/g, ' ').trim();

  useEffect(() => {
    if (!isVisible) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isVisible]);
  const searching = term.length >= MIN_SEARCH_LENGTH;

  const changeQuery = (text: string) => {
    setQuery(text);
    const ready = text.replace(/\s+/g, ' ').trim().length >= MIN_SEARCH_LENGTH;
    setLoading(ready);
    if (!ready) setResults(null);
  };

  useEffect(() => {
    if (!searching || conversationId == null) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      searchConversation(conversationId, term, abort.signal)
        .then((messages) => {
          setResults(messages);
          setFailed(false);
        })
        .catch(() => !abort.signal.aborted && setFailed(true))
        .finally(() => !abort.signal.aborted && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [term, searching, conversationId]);

  const close = () => {
    changeQuery('');
    onClose();
  };

  return (
    <SwipeableModal
      isVisible={isVisible}
      onClose={close}
      maxHeight={Dimensions.get('window').height * 0.8}
      style={{ height: Dimensions.get('window').height * 0.8 }}
    >
      <View style={styles.container}>
        <View style={[styles.search, { backgroundColor: colors.raised }]}>
          <Feather name='search' size={15} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={changeQuery}
            placeholder={`Search your chat with ${peerName.split(' ')[0] || 'them'}`}
            placeholderTextColor={colors.mutedForeground}
            ref={inputRef}
            autoCorrect={false}
            returnKeyType='search'
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {loading ? <ActivityIndicator size='small' color={colors.mutedForeground} /> : null}
        </View>

        <FlatList
          data={searching ? (results ?? []) : []}
          keyExtractor={(m) => String(m.id)}
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {!searching
                ? 'Find a message by its words or a file by its name.'
                : failed
                  ? "Couldn't search. Check your connection and try again."
                  : results && !loading
                    ? `Nothing in this chat matches "${term}"`
                    : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => {
                changeQuery('');
                onPick(item);
              }}
              scaleTo={ROW_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityHint='Goes to this message'
              style={styles.row}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.who, { color: colors.foreground }]}>
                  {item.senderId === meId ? 'You' : peerName}
                </Text>
                <Text style={[styles.when, { color: colors.mutedForeground }]}>
                  {formatWhen(item.createdAt)}
                </Text>
              </View>
              <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={3}>
                <Highlighted
                  text={item.body || item.attachment?.name || previewOf(item, null)}
                  query={term}
                  color={colors.foreground}
                />
              </Text>
            </PressableScale>
          )}
        />
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { fontSize: 14, fontWeight: '600' },
  when: { fontSize: 12, fontVariant: ['tabular-nums'] },
  text: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  match: { fontWeight: '700' },
  empty: { textAlign: 'center', fontSize: 14, marginTop: 40, paddingHorizontal: 24 },
});

export default ChatSearchSheet;
