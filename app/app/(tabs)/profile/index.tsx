import DeveloperProfileModal from '@/components/DeveloperProfileModal';
import LoginScreen from '@/components/LoginScreen';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { ProfileIdentity } from '@/components/profile/ProfileIdentity';
import { SettingsGroup, SettingsRow } from '@/components/profile/SettingsGroup';
import { UpdateCard } from '@/components/profile/UpdateCard';
import { StackHeader } from '@/components/ui/AppHeader';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { useAppUpdate } from '@/context/AppUpdateContext';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

type ThemeChoice = 'light' | 'system' | 'dark';

const THEME_OPTIONS: SegmentOption<ThemeChoice>[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/**
 * Profile and settings. Reached from the avatar in every tab header (it's no longer a tab),
 * so it uses the pushed-page header with a back button.
 */
export default function ProfileScreen() {
  const { user, logout, getProfile, loading } = useUser();
  const { colors, setTheme, themePreference } = useTheme();
  const { currentVersion } = useAppUpdate();
  const [showDeveloper, setShowDeveloper] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('token').then((token) => {
      if (!user && token) getProfile();
    });
  }, [user, getProfile]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out?', "You'll need to sign in again to use SyncVibe.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(tabs)/home');
        },
      },
    ]);
  }, [logout]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StackHeader title='Profile' />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
      >
        <ProfileIdentity
          user={user}
          onChangePhoto={() => router.push('/update-profile-picture')}
          onEdit={() => router.push('/edit-profile')}
        />

        <UpdateCard />

        <SettingsGroup title='Appearance'>
          <View style={styles.themeRow}>
            <Segmented
              options={THEME_OPTIONS}
              value={themePreference as ThemeChoice}
              onChange={setTheme}
              accessibilityLabel='Theme'
            />
          </View>
        </SettingsGroup>

        <SettingsGroup title='Music'>
          <SettingsRow
            icon='globe'
            label='Music languages'
            detail='Shapes recommendations and Home'
            onPress={() => router.push('/music-language')}
          />
          <SettingsRow
            icon='clock'
            label='Listening history'
            onPress={() => router.push('/song-history')}
          />
        </SettingsGroup>

        <SettingsGroup title='About'>
          <SettingsRow
            icon='code'
            label='Meet the developer'
            onPress={() => setShowDeveloper(true)}
          />
          <SettingsRow
            icon='smartphone'
            label='App version'
            trailing={
              <Text style={[styles.version, { color: colors.mutedForeground }]}>
                {currentVersion}
              </Text>
            }
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon='log-out' label='Log out' destructive onPress={confirmLogout} />
        </SettingsGroup>
      </ScrollView>

      <DeveloperProfileModal isVisible={showDeveloper} onClose={() => setShowDeveloper(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 22 },
  themeRow: { padding: 10 },
  version: { fontSize: 14, fontVariant: ['tabular-nums'] },
});
