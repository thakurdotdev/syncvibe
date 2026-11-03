import React, { useCallback, useMemo, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Alert,
  Share,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { Feather, Ionicons } from '@expo/vector-icons';
import LoginScreen from '@/components/LoginScreen';
import QRScannerScreen from '@/app/qr-scanner';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { GroupInfoCard } from '@/components/music/group/GroupInfoCard';
import { CurrentSongCard } from '@/components/music/group/CurrentSongCard';
import { GroupMembersCard } from '@/components/music/group/GroupMembersCard';
import { CreateOrJoinModal } from '@/components/music/group/CreateOrJoinModal';

import { QRCodeModal } from '@/components/music/group/QRCodeModal';
import { QueueSheet } from '@/components/music/group/QueueSheet';
import { InviteSheet } from '@/components/music/group/InviteSheet';
import { InviteNotification } from '@/components/music/group/InviteNotification';
import { ChatScreen } from '@/components/music/group/ChatScreen';
import { ChatPeek } from '@/components/music/group/ChatPeek';
import { FloatingReactions } from '@/components/music/group/FloatingReactions';
import { ConnectionBadge } from '@/components/music/group/ConnectionBadge';
import { GlobalSoundAnimation } from '@/components/music/group/GlobalSoundAnimation';
import { HeaderIconButton, TabHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { fonts } from '@/theme/typography';

const HeaderActions = React.memo(
  ({
    onOpenQueue,
    onLeave,
    showInlineQueue,
    onToggleInlineQueue,
  }: {
    onOpenQueue: () => void;
    onLeave: () => void;
    showInlineQueue: boolean;
    onToggleInlineQueue: () => void;
  }) => {
    const { colors } = useTheme();
    const queue = useGroupSessionStore((s) => s.queue);
    const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex);

    const activeQueueCount = useMemo(() => {
      const currentItem = currentQueueIndex >= 0 && queue[currentQueueIndex] ? 1 : 0;
      const upcoming = queue.filter((_, idx) => idx > currentQueueIndex).length;
      return currentItem + upcoming;
    }, [queue, currentQueueIndex]);

    return (
      <View style={styles.headerRight}>
        <HeaderIconButton
          label={showInlineQueue ? 'Disable side queue' : 'Enable side queue'}
          onPress={onToggleInlineQueue}
        >
          <Feather name='columns' size={17} color={colors.foreground} />
        </HeaderIconButton>
        <HeaderIconButton label='Open queue' onPress={onOpenQueue}>
          <Feather name='list' size={18} color={colors.foreground} />
          {activeQueueCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.headerBadgeText, { color: colors.primaryForeground }]}>
                {activeQueueCount}
              </Text>
            </View>
          )}
        </HeaderIconButton>
        <HeaderIconButton label='Leave room' onPress={onLeave}>
          <Feather name='log-out' size={18} color={colors.foreground} />
        </HeaderIconButton>
      </View>
    );
  }
);

export default function GroupMusicMobile() {
  const { width } = useWindowDimensions();
  const { handlePlayPause, handleSeek, createGroup, joinGroup, leaveGroup, skipSong } =
    useGroupMusic();

  const { user } = useUser();
  const { colors } = useTheme();

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const groupMembers = useGroupSessionStore((s) => s.groupMembers);
  const isGroupModalOpen = useGroupSessionStore((s) => s.isGroupModalOpen);
  const isQueueOpen = useGroupSessionStore((s) => s.isQueueOpen);
  const isRejoining = useGroupSessionStore((s) => s.isRejoining);
  const isInviteSheetOpen = useGroupInviteStore((s) => s.isInviteSheetOpen);

  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [scanQrCode, setScanQrCode] = useState(false);
  const [showInlineQueue, setShowInlineQueue] = useState(false);
  const [queuePreferenceLoaded, setQueuePreferenceLoaded] = useState(false);
  const canShowInlineQueue = Platform.OS === 'web' && width >= 1100;

  React.useEffect(() => {
    AsyncStorage.getItem('@group_music_inline_queue')
      .then((value) => setShowInlineQueue(value === 'true'))
      .catch(() => {})
      .finally(() => setQueuePreferenceLoaded(true));
  }, []);
  const toggleInlineQueue = useCallback(() => {
    setShowInlineQueue((value) => {
      const next = !value;
      AsyncStorage.setItem('@group_music_inline_queue', String(next)).catch(() => {});
      return next;
    });
  }, []);
  const inlineQueue =
    queuePreferenceLoaded && showInlineQueue && canShowInlineQueue && !!currentGroup;

  const handleOpenQueue = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: true });
  }, []);

  const handleCopyGroupId = useCallback(async () => {
    if (currentGroup?.id) {
      await Share.share({
        message: `Join my SyncVibe group! Group ID: ${currentGroup.id}`,
      });
    }
  }, [currentGroup?.id]);

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave ${currentGroup?.name || 'this group'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveGroup },
      ]
    );
  }, [currentGroup?.name, leaveGroup]);

  if (!user) return <LoginScreen />;

  return (
    <>
      {scanQrCode ? (
        <QRScannerScreen
          onScanComplete={(qrCode) => {
            joinGroup(qrCode);
            setScanQrCode(false);
          }}
          onClose={() => {
            setScanQrCode(false);
            useGroupSessionStore.setState({ isGroupModalOpen: false });
          }}
        />
      ) : (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <TabSafeAreaView edges={['top']}>
            <TabHeader
              title='Rooms'
              accessory={currentGroup ? <ConnectionBadge /> : null}
              showSearch={!currentGroup}
              actions={
                currentGroup ? (
                  <HeaderActions
                    onOpenQueue={handleOpenQueue}
                    onLeave={handleLeaveGroup}
                    showInlineQueue={showInlineQueue}
                    onToggleInlineQueue={toggleInlineQueue}
                  />
                ) : null
              }
            />
          </TabSafeAreaView>

          <InviteNotification />

          {!currentGroup ? (
            <ScrollView
              contentContainerStyle={styles.welcomeContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.welcomeIconWrap, { backgroundColor: colors.accent }]}>
                <Ionicons name='people-outline' size={32} color={colors.primary} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Listen together
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
                Start a room or join a friend. Playback stays in sync for everyone listening.
              </Text>
              <PressableScale
                onPress={() => useGroupSessionStore.setState({ isGroupModalOpen: true })}
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                accessibilityRole='button'
                accessibilityLabel='Create or join a music group'
              >
                <Feather name='plus' size={19} color={colors.primaryForeground} />
                <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>
                  Create or join a room
                </Text>
              </PressableScale>
              <Text style={[styles.welcomeFootnote, { color: colors.mutedForeground }]}>
                Use an invite link or QR code to join a room.
              </Text>
            </ScrollView>
          ) : (
            <View style={[{ flex: 1, minHeight: 0 }, inlineQueue && styles.splitLayout]}>
              <ScrollView
                style={[styles.scrollContainer, inlineQueue && styles.playerColumn]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <GroupInfoCard
                  groupName={currentGroup.name}
                  groupId={currentGroup.id}
                  onCopyId={handleCopyGroupId}
                  onOpenInvite={() => useGroupInviteStore.setState({ isInviteSheetOpen: true })}
                  onShowQRCode={() => setShowQRCodeModal(true)}
                />

                <CurrentSongCard
                  onChooseSong={handleOpenQueue}
                  onPlayPause={handlePlayPause}
                  onSeek={handleSeek}
                  onSkip={skipSong}
                />

                <ChatPeek onOpenChat={() => setShowChatSheet(true)} />

                <GroupMembersCard groupMembers={groupMembers} hostId={currentGroup.createdBy} />
              </ScrollView>

              {inlineQueue && (
                <View
                  style={[
                    styles.queueColumn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <QueueSheet inline />
                </View>
              )}

              <FloatingReactions />
            </View>
          )}

          {isGroupModalOpen && (
            <CreateOrJoinModal
              isOpen
              onClose={() => useGroupSessionStore.setState({ isGroupModalOpen: false })}
              onCreateGroup={createGroup}
              onJoinGroup={joinGroup}
              onScanQRCode={() => setScanQrCode(true)}
            />
          )}

          {isQueueOpen && !inlineQueue && <QueueSheet />}

          {currentGroup?.qrCode && (
            <QRCodeModal
              isOpen={showQRCodeModal}
              onClose={() => setShowQRCodeModal(false)}
              qrCode={currentGroup.qrCode}
            />
          )}

          {isInviteSheetOpen && (
            <InviteSheet
              isOpen
              onClose={() => useGroupInviteStore.setState({ isInviteSheetOpen: false })}
            />
          )}

          {showChatSheet && <ChatScreen isOpen onClose={() => setShowChatSheet(false)} />}

          <GlobalSoundAnimation currentUserId={user?.userid} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splitLayout: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    minHeight: 0,
    overflow: 'hidden',
  },
  playerColumn: { flex: 0.6, minWidth: 0, minHeight: 0 },
  queueColumn: {
    flex: 0.4,
    minWidth: 0,
    minHeight: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  welcomeContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 56,
  },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 23,
  },
  createButton: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createButtonText: {
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 15,
  },
  welcomeFootnote: {
    marginTop: 14,
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});
