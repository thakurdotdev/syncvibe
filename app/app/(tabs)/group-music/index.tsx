import QRScannerScreen from '@/app/qr-scanner';
import LoginScreen from '@/components/LoginScreen';
import { CreateOrJoinModal } from '@/components/music/group/CreateOrJoinModal';
import { GlobalSoundAnimation } from '@/components/music/group/GlobalSoundAnimation';
import { InviteNotification } from '@/components/music/group/InviteNotification';
import { InviteSheet } from '@/components/music/group/InviteSheet';
import { QRCodeModal } from '@/components/music/group/QRCodeModal';
import { QueueSheet } from '@/components/music/group/QueueSheet';
import { RoomScreen } from '@/components/music/room/RoomScreen';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { TabHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

const STEPS = [
  { icon: 'radio-outline', text: 'Start a room or join one with a code or QR.' },
  { icon: 'musical-notes-outline', text: 'Anyone can add songs; everyone hears them in sync.' },
  { icon: 'chatbubbles-outline', text: 'Chat, reply, react and drop GIFs while you listen.' },
] as const;

const openRoomModal = () => useGroupSessionStore.setState({ isGroupModalOpen: true });

/** Shown when you're not in a room: what rooms are, and the one action to start. */
function Welcome({ onScan }: { onScan: () => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.welcome, { paddingBottom: DECK_CLEARANCE }]}>
      <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Listen together</Text>
      <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
        Play the same song at the same second as your friends, wherever they are.
      </Text>

      <View style={[styles.steps, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {STEPS.map((s) => (
          <View key={s.icon} style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name={s.icon} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.stepText, { color: colors.foreground }]}>{s.text}</Text>
          </View>
        ))}
      </View>

      <PressableScale
        onPress={openRoomModal}
        accessibilityRole='button'
        style={[styles.primary, { backgroundColor: colors.primary }]}
      >
        <Ionicons name='add' size={20} color={colors.primaryForeground} />
        <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
          Start or join a room
        </Text>
      </PressableScale>
      <PressableScale
        onPress={onScan}
        accessibilityRole='button'
        style={[styles.secondary, { backgroundColor: colors.raised }]}
      >
        <Ionicons name='qr-code-outline' size={18} color={colors.foreground} />
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>Scan a room QR</Text>
      </PressableScale>
    </ScrollView>
  );
}

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

  const [showQr, setShowQr] = useState(false);
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
        <Welcome onScan={() => setScanning(true)} />
      )}

      {isGroupModalOpen && (
        <CreateOrJoinModal
          isOpen
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
  welcome: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  welcomeTitle: { fontFamily: fonts.displayHeavy, fontSize: 32, letterSpacing: -0.9 },
  welcomeText: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  steps: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 14,
    marginTop: 4,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19 },
  primary: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 14 },
});
