import { FloatingReactions } from '@/components/music/group/FloatingReactions';
import { QueueSheet } from '@/components/music/group/QueueSheet';
import { DECK_NAV_HEIGHT } from '@/components/music/UnifiedBottomDeck';
import { useUser } from '@/context/UserContext';
import { KeyboardSpacer } from '@/components/ui/KeyboardSpacer';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { memo, useCallback, useMemo, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatPanel } from './chat/ChatPanel';
import { isActivity, sameUser } from './chat/chatUtils';
import { PeoplePanel } from './PeoplePanel';
import { RoomHeader } from './RoomHeader';
import { RoomPlayer } from './RoomPlayer';
import { RoomTabs, type RoomTab } from './RoomTabs';

/**
 * Unread chat messages from other people since you last left the Chat panel. `markSeen`
 * is called on tab change, so there's no state syncing in effects.
 */
function useUnreadWhileAway(active: boolean) {
  const { user } = useUser();
  const messages = useGroupSessionStore((s) => s.messages);
  const [seenCount, setSeenCount] = useState(messages.length);

  const unread = useMemo(
    () =>
      active
        ? 0
        : messages
            .slice(seenCount)
            .filter((m) => !isActivity(m) && !sameUser(m.senderId, user?.userid)).length,
    [active, messages, seenCount, user?.userid]
  );

  const markSeen = useCallback(
    () => setSeenCount(useGroupSessionStore.getState().messages.length),
    []
  );
  return { unread, markSeen };
}

/**
 * The room, once you're in one: header, shared player, then Chat / Queue / People filling
 * the rest of the screen. Panels stay mounted when hidden so switching is instant and chat
 * keeps its scroll position and draft.
 */
export const RoomScreen = memo(function RoomScreen({
  onInvite,
  onShowQr,
  onShare,
  onLeave,
}: {
  onInvite: () => void;
  onShowQr: () => void;
  onShare: () => void;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const focused = useIsFocused();
  const [tab, setTab] = useState<RoomTab>('chat');

  const queueCount = useGroupSessionStore(
    (s) => s.queue.filter((_, i) => i > s.currentQueueIndex).length
  );
  const memberCount = useGroupSessionStore((s) => s.groupMembers.length);
  const { unread, markSeen } = useUnreadWhileAway(tab === 'chat');

  const changeTab = useCallback(
    (next: RoomTab) => {
      // Leaving chat (or arriving at it) resets the "seen" mark.
      if (next === 'chat' || tab === 'chat') markSeen();
      setTab(next);
    },
    [tab, markSeen]
  );

  // Leave room for the app-wide tab bar, except while the keyboard has hidden it.
  const deckInset = keyboardVisible ? 0 : DECK_NAV_HEIGHT + Math.max(6, insets.bottom);

  const badges = useMemo(
    () => ({ chat: unread, queue: queueCount, people: memberCount }),
    [unread, queueCount, memberCount]
  );

  const showQueue = useCallback(() => changeTab('queue'), [changeTab]);
  const showPeople = useCallback(() => changeTab('people'), [changeTab]);

  return (
    <View style={styles.root}>
      <RoomHeader
        onInvite={onInvite}
        onShowQr={onShowQr}
        onShare={onShare}
        onLeave={onLeave}
        onShowPeople={showPeople}
      />

      {/* While typing, give the conversation the space; the player returns with the keyboard. */}
      {!keyboardVisible && (
        <View style={styles.player}>
          <RoomPlayer onChooseSong={showQueue} />
          <FloatingReactions />
        </View>
      )}

      <View style={styles.tabs}>
        <RoomTabs active={tab} onChange={changeTab} badges={badges} />
      </View>

      <View style={styles.panels}>
        <View style={[styles.panel, tab !== 'chat' && styles.hidden]}>
          <ChatPanel bottomInset={deckInset} />
        </View>
        <View
          style={[styles.panel, tab !== 'queue' && styles.hidden, { paddingBottom: deckInset }]}
        >
          <QueueSheet inline embedded />
        </View>
        <View style={[styles.panel, tab !== 'people' && styles.hidden]}>
          <PeoplePanel onInvite={onInvite} bottomInset={deckInset} />
        </View>
      </View>

      {/* Lifts the composer above the keyboard (edge-to-edge Android doesn't resize). */}
      {focused && <KeyboardSpacer />}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  player: { paddingHorizontal: 16 },
  tabs: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  panels: { flex: 1, minHeight: 0 },
  panel: { ...StyleSheet.absoluteFill },
  // Hidden panels stay mounted (state, scroll, drafts) but take no input or paint.
  hidden: { display: 'none' },
});
