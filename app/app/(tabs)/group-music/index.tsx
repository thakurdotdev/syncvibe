import QRScannerScreen from '@/app/qr-scanner';
import LoginScreen from '@/components/LoginScreen';
import { CreateOrJoinModal } from '@/components/music/group/CreateOrJoinModal';
import { GlobalSoundAnimation } from '@/components/music/group/GlobalSoundAnimation';
import { InviteNotification } from '@/components/music/group/InviteNotification';
import { InviteSheet } from '@/components/music/group/InviteSheet';
import { QRCodeModal } from '@/components/music/group/QRCodeModal';
import { QueueSheet } from '@/components/music/group/QueueSheet';
import { RoomScreen } from '@/components/music/room/RoomScreen';
import { RoomsWelcome } from '@/components/music/room/RoomsWelcome';
import { useMyRooms } from '@/components/music/room/useMyRooms';
import { TabHeader } from '@/components/ui/AppHeader';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useChat } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';

function Reconnecting() {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
        Reconnecting to your room…
      </Text>
    </View>
  );
}

/** Rooms tab: welcome, reconnecting, or the live room, plus the sheets rooms use. */
export default function RoomsTab() {
  const { createGroup, joinGroup, leaveGroup } = useGroupMusic();
  const { user } = useUser();
  const { colors } = useTheme();

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const isRejoining = useGroupSessionStore((s) => s.isRejoining);
  const isGroupModalOpen = useGroupSessionStore((s) => s.isGroupModalOpen);
  const isQueueOpen = useGroupSessionStore((s) => s.isQueueOpen);
  const isInviteSheetOpen = useGroupInviteStore((s) => s.isInviteSheetOpen);
  const { socket } = useChat();
  const myRooms = useMyRooms(socket, currentGroup?.id);

  const [showQr, setShowQr] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create');

  const openModal = useCallback((tab: 'create' | 'join') => {
    setModalTab(tab);
    useGroupSessionStore.setState({ isGroupModalOpen: true });
  }, []);
  const [scanning, setScanning] = useState(false);

  const openInvite = useCallback(
    () => useGroupInviteStore.setState({ isInviteSheetOpen: true }),
    []
  );
  const openQr = useCallback(() => setShowQr(true), []);

  const shareCode = useCallback(() => {
    if (!currentGroup?.id) return;
    Share.share({
      message: `Join my room "${currentGroup.name}" on SyncVibe. Room code: ${currentGroup.id}`,
    }).catch(() => {});
  }, [currentGroup]);

  const confirmLeave = useCallback(() => {
    Alert.alert(
      'Leave room?',
      `You'll stop listening along in ${currentGroup?.name || 'this room'}.`,
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveGroup },
      ]
    );
  }, [currentGroup, leaveGroup]);

  if (!user) return <LoginScreen />;

  if (scanning) {
    return (
      <QRScannerScreen
        onScanComplete={(code) => {
          joinGroup(code);
          setScanning(false);
        }}
        onClose={() => {
          setScanning(false);
          useGroupSessionStore.setState({ isGroupModalOpen: false });
        }}
      />
    );
  }

  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      {!currentGroup && <TabHeader title='Rooms' />}
      <InviteNotification />

      {currentGroup ? (
        <RoomScreen
          onInvite={openInvite}
          onShowQr={openQr}
          onShare={shareCode}
          onLeave={confirmLeave}
        />
      ) : isRejoining ? (
        <Reconnecting />
      ) : (
        <RoomsWelcome
          myRooms={myRooms.rooms}
          onJoinRoom={joinGroup}
          onDismissRoom={myRooms.dismiss}
          onStart={() => openModal('create')}
          onJoin={() => openModal('join')}
          onScan={() => setScanning(true)}
        />
      )}

      {isGroupModalOpen && (
        <CreateOrJoinModal
          isOpen
          initialTab={modalTab}
          onClose={() => useGroupSessionStore.setState({ isGroupModalOpen: false })}
          onCreateGroup={createGroup}
          onJoinGroup={joinGroup}
          onScanQRCode={() => setScanning(true)}
        />
      )}

      {/* Other screens can still open the full-screen queue (e.g. "add to room"). */}
      {isQueueOpen && <QueueSheet />}

      {currentGroup?.qrCode && (
        <QRCodeModal
          isOpen={showQr}
          onClose={() => setShowQr(false)}
          qrCode={currentGroup.qrCode}
        />
      )}

      {isInviteSheetOpen && (
        <InviteSheet
          isOpen
          onClose={() => useGroupInviteStore.setState({ isInviteSheetOpen: false })}
        />
      )}

      <GlobalSoundAnimation currentUserId={user?.userid} />
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 14 },
});
