import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import LoginScreen from '@/components/LoginScreen';
import QRScannerScreen from '@/app/qr-scanner';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { GroupInfoCard } from '@/components/music/group/GroupInfoCard';
import { CurrentSongCard } from '@/components/music/group/CurrentSongCard';
import { GroupMembersCard } from '@/components/music/group/GroupMembersCard';
import { CreateOrJoinModal } from '@/components/music/group/CreateOrJoinModal';
import { SearchModal } from '@/components/music/group/SearchModal';
import { QRCodeModal } from '@/components/music/group/QRCodeModal';
import { QueueSheet } from '@/components/music/group/QueueSheet';

const HeaderActions = React.memo(
  ({
    onOpenQueue,
    onOpenSearch,
    onLeave,
  }: {
    onOpenQueue: () => void;
    onOpenSearch: () => void;
    onLeave: () => void;
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
        <TouchableOpacity
          onPress={onOpenQueue}
          style={[styles.headerButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name='list' size={18} color={colors.foreground} />
          {activeQueueCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.headerBadgeText, { color: colors.primaryForeground }]}>
                {activeQueueCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenSearch}
          style={[styles.headerButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name='search' size={18} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onLeave}
          style={[styles.headerButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name='log-out' size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    );
  }
);

export default function GroupMusicMobile() {
  const { handlePlayPause, handleSeek, createGroup, joinGroup, leaveGroup, skipSong } =
    useGroupMusic();

  const { user } = useUser();
  const { colors } = useTheme();

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const groupMembers = useGroupSessionStore((s) => s.groupMembers);
  const isGroupModalOpen = useGroupSessionStore((s) => s.isGroupModalOpen);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [scanQrCode, setScanQrCode] = useState(false);

  const handleOpenQueue = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: true });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearchModal(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearchModal(false);
  }, []);

  const handleCopyGroupId = useCallback(() => {
    if (currentGroup?.id) {
      alert(`Group ID: ${currentGroup.id}\nCopy from here.`);
    }
  }, [currentGroup?.id]);

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
          <Animated.View style={styles.gradientContainer}>
            <LinearGradient
              colors={[colors.gradients.background[0], colors.gradients.background[1]]}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.8, y: 0.85 }}
              style={styles.gradient}
            />
          </Animated.View>

          <SafeAreaView style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name='musical-notes-outline' size={24} color={colors.foreground} />
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Group Music</Text>
            </View>
            {currentGroup && (
              <HeaderActions
                onOpenQueue={handleOpenQueue}
                onOpenSearch={handleOpenSearch}
                onLeave={leaveGroup}
              />
            )}
          </SafeAreaView>

          {!currentGroup ? (
            <View style={styles.welcomeContainer}>
              <Ionicons name='people-outline' size={72} color={colors.foreground} />
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Sync Your Vibe with Friends
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
                Create a group to listen to music together. Invite your friends to join and start
                playing music for everyone in the group.
              </Text>
              <TouchableOpacity
                onPress={() => useGroupSessionStore.setState({ isGroupModalOpen: true })}
                style={[styles.createButton, { backgroundColor: colors.primary }]}
              >
                <Feather name='plus-circle' size={18} color={colors.primaryForeground} />
                <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>
                  Create or Join Group
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              <GroupInfoCard
                groupName={currentGroup.name}
                groupId={currentGroup.id}
                onCopyId={handleCopyGroupId}
                onShowQRCode={() => setShowQRCodeModal(true)}
              />

              <CurrentSongCard
                onChooseSong={handleOpenSearch}
                onOpenQueue={handleOpenQueue}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSkip={skipSong}
              />

              <GroupMembersCard
                groupMembers={groupMembers}
                hostId={currentGroup.createdBy}
              />
            </View>
          )}

          <CreateOrJoinModal
            isOpen={isGroupModalOpen}
            onClose={() => useGroupSessionStore.setState({ isGroupModalOpen: false })}
            onCreateGroup={createGroup}
            onJoinGroup={joinGroup}
            onScanQRCode={() => setScanQrCode(true)}
          />

          <SearchModal isOpen={showSearchModal} onClose={handleCloseSearch} />

          <QueueSheet onOpenSearch={handleOpenSearch} />

          {currentGroup?.qrCode && (
            <QRCodeModal
              isOpen={showQRCodeModal}
              onClose={() => setShowQRCodeModal(false)}
              qrCode={currentGroup.qrCode}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    zIndex: 0,
  },
  gradient: {
    height: '100%',
    width: '100%',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  headerButton: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 32,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 40,
    fontSize: 16,
    lineHeight: 22,
  },
  createButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createButtonText: {
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
  },
});
