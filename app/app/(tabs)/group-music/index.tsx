import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import LoginScreen from '@/components/LoginScreen';
import QRScannerScreen from '@/app/qr-scanner';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { GroupInfoCard } from '@/components/music/group/GroupInfoCard';
import { CurrentSongCard } from '@/components/music/group/CurrentSongCard';
import { GroupMembersCard } from '@/components/music/group/GroupMembersCard';
import { CreateOrJoinModal } from '@/components/music/group/CreateOrJoinModal';
import { SearchModal } from '@/components/music/group/SearchModal';
import { QRCodeModal } from '@/components/music/group/QRCodeModal';

export default function GroupMusicMobile() {
  const {
    currentGroup,
    groupMembers,
    searchResults,
    searchQuery,
    setSearchQuery,
    currentSong,
    isSearchLoading,
    isPlaying,
    isGroupModalOpen,
    setIsGroupModalOpen,
    debouncedSearch,
    createGroup,
    joinGroup,
    leaveGroup,
    selectSong,
    handlePlayPause,
  } = useGroupMusic();
  const { user } = useUser();
  const { colors } = useTheme();
  const [, setGroupId] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [scanQrCode, setScanQrCode] = useState(false);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleCopyGroupId = () => {
    if (currentGroup?.id) {
      alert(`Group ID: ${currentGroup.id}\nCopy from here.`);
    }
  };

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      {scanQrCode ? (
        <QRScannerScreen
          onScanComplete={(qrCode) => {
            setGroupId(qrCode);
            joinGroup(qrCode);
            setScanQrCode(false);
          }}
          onClose={() => {
            setScanQrCode(false);
            setIsGroupModalOpen(false);
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              height: '100%',
              zIndex: 0,
            }}
          >
            <LinearGradient
              colors={[colors.gradients.background[0], colors.gradients.background[1]]}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.8, y: 0.85 }}
              style={{
                height: '100%',
                width: '100%',
              }}
            />
          </Animated.View>
          <SafeAreaView
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 1 }}>
              <Ionicons name='musical-notes-outline' size={24} color={colors.foreground} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 20,
                  fontWeight: '600',
                  marginLeft: 10,
                }}
              >
                Group Music
              </Text>
            </View>
            {currentGroup && (
              <View style={{ flexDirection: 'row', zIndex: 1 }}>
                <TouchableOpacity
                  onPress={() => setShowSearchModal(true)}
                  style={{
                    backgroundColor: colors.secondary,
                    padding: 10,
                    borderRadius: 12,
                    marginRight: 30,
                  }}
                  className='flex-row items-center'
                >
                  <Feather name='search' size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, marginLeft: 6 }}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={leaveGroup}
                  style={{
                    backgroundColor: colors.secondary,
                    padding: 10,
                    borderRadius: 12,
                  }}
                >
                  <Feather name='log-out' size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>

          {!currentGroup ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 32,
              }}
            >
              <Ionicons name='people-outline' size={72} color={colors.foreground} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 26,
                  fontWeight: '700',
                  marginTop: 32,
                  textAlign: 'center',
                }}
              >
                Sync Your Vibe with Friends
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  textAlign: 'center',
                  marginTop: 12,
                  marginBottom: 40,
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                Create a group to listen to music together. Invite your friends to join and start
                playing music for everyone in the group.
              </Text>
              <TouchableOpacity
                onPress={() => setIsGroupModalOpen(true)}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Feather name='plus-circle' size={18} color={colors.primaryForeground} />
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontWeight: '700',
                    marginLeft: 8,
                    fontSize: 16,
                  }}
                >
                  Create or Join Group
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <GroupInfoCard
                groupName={currentGroup.name}
                groupId={currentGroup.id}
                onCopyId={handleCopyGroupId}
                onShowQRCode={() => setShowQRCodeModal(true)}
              />

              <CurrentSongCard
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onChooseSong={() => setShowSearchModal(true)}
              />

              <GroupMembersCard
                groupMembers={groupMembers}
                hostId={currentGroup.createdBy}
              />
            </View>
          )}

          <CreateOrJoinModal
            isOpen={isGroupModalOpen}
            onClose={() => setIsGroupModalOpen(false)}
            onCreateGroup={createGroup}
            onJoinGroup={joinGroup}
            onScanQRCode={() => setScanQrCode(true)}
          />

          <SearchModal
            isOpen={showSearchModal}
            onClose={() => setShowSearchModal(false)}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            isSearchLoading={isSearchLoading}
            searchResults={searchResults}
            onSelectSong={selectSong}
          />

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
