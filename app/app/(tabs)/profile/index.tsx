import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ChevronRightIcon,
  LaptopIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react-native';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, Text, TouchableOpacity, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeveloperProfileModal from '@/components/DeveloperProfileModal';
import LoginScreen from '@/components/LoginScreen';
import Card from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useAppUpdate } from '@/context/AppUpdateContext';
import type { ThemeColors } from '@/theme/color';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';

const SectionHeader = ({
  icon,
  title,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  colors: ThemeColors;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View
      style={{
        backgroundColor: colors.accent,
        borderRadius: 12,
        padding: 10,
        marginRight: 12,
      }}
    >
      {icon}
    </View>
    <Card.Title>{title}</Card.Title>
  </View>
);

const ThemeToggle = memo(() => {
  const { colors, setTheme, themePreference } = useTheme();
  const selectedTheme = themePreference;

  const handleThemeChange = useCallback(
    (newTheme: 'light' | 'system' | 'dark') => {
      setTheme(newTheme);
    },
    [setTheme]
  );

  const themeButtons = useMemo(
    () => (
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.secondary,
          borderRadius: 20,
          padding: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => handleThemeChange('light')}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: selectedTheme === 'light' ? colors.primary : 'transparent',
            marginRight: 4,
          }}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel='Light theme'
          accessibilityState={{ selected: selectedTheme === 'light' }}
        >
          <SunIcon
            size={20}
            color={selectedTheme === 'light' ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleThemeChange('system')}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: selectedTheme === 'system' ? colors.primary : 'transparent',
            marginRight: 4,
          }}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel='System theme'
          accessibilityState={{ selected: selectedTheme === 'system' }}
        >
          <LaptopIcon
            size={20}
            color={selectedTheme === 'system' ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleThemeChange('dark')}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: selectedTheme === 'dark' ? colors.primary : 'transparent',
          }}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel='Dark theme'
          accessibilityState={{ selected: selectedTheme === 'dark' }}
        >
          <MoonIcon
            size={20}
            color={selectedTheme === 'dark' ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    ),
    [colors, selectedTheme, handleThemeChange]
  );

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>Theme</Text>
        {themeButtons}
      </View>
    </View>
  );
});
ThemeToggle.displayName = 'ThemeToggle';

const SettingItem = ({
  icon,
  title,
  subtitle,
  onPress,
  isDestructive = false,
  isLast = false,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isDestructive?: boolean;
  isLast?: boolean;
  colors: ThemeColors;
}) => {
  const pressScale = useState(() => new Animated.Value(1))[0];

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={title}
    >
      <Animated.View
        style={{
          transform: [{ scale: pressScale }],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          // Bottom hairline divider between rows instead of relying on
          // card padding alone to separate items — keeps multi-row
          // sections scannable without adding another nested Card.
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View
            style={{
              backgroundColor: isDestructive ? `${colors.destructive}1A` : colors.secondary,
              borderRadius: 12,
              padding: 10,
              marginRight: 12,
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: isDestructive ? colors.destructive : colors.foreground,
                fontSize: 16,
                fontWeight: '500',
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {!isDestructive && <ChevronRightIcon size={20} color={colors.mutedForeground} />}
      </Animated.View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// ProfileHeader — isolated so the gradient + avatar block reads as one
// cohesive unit. Fixes the original bug where name/email used
// `colors.background` as a text color (only worked by coincidence on a
// white/near-black background); now uses `colors.primaryForeground`,
// the token the palette actually defines for "text that sits on primary."
// ---------------------------------------------------------------------------
const ProfileHeader = ({
  user,
  colors,
  onAvatarPress,
  onCameraPress,
}: {
  user: any;
  colors: ThemeColors;
  onAvatarPress: () => void;
  onCameraPress: () => void;
}) => {
  const entrance = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <View style={{ marginBottom: 24 }}>
      <LinearGradient
        colors={[colors.primary, `${colors.primary}95`, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ height: 260, position: 'absolute', left: 0, right: 0, top: 0 }}
      />

      <Animated.View
        style={{
          paddingTop: 28,
          paddingHorizontal: 24,
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
            },
          ],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
          <Pressable
            onPress={onAvatarPress}
            accessibilityRole='button'
            accessibilityLabel='Change profile picture'
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            <Image
              source={{ uri: getOptimizedImageUrl(user?.profilepic) }}
              style={{
                width: 92,
                height: 92,
                borderRadius: 46,
                borderWidth: 3,
                borderColor: colors.primaryForeground,
              }}
              resizeMode='cover'
            />
            <Pressable
              onPress={onCameraPress}
              accessibilityRole='button'
              accessibilityLabel='Update profile picture'
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                backgroundColor: colors.primary,
                borderRadius: 14,
                width: 30,
                height: 30,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: colors.primaryForeground,
              }}
            >
              <Feather name='camera' size={13} color={colors.primaryForeground} />
            </Pressable>
          </Pressable>

          <View style={{ flex: 1, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: colors.primaryForeground,
                  letterSpacing: -0.4,
                }}
                numberOfLines={1}
              >
                {user?.name}
              </Text>
              {user?.verified && (
                <MaterialCommunityIcons
                  name='check-decagram'
                  size={20}
                  color={colors.primaryForeground}
                  style={{ opacity: 0.95 }}
                />
              )}
            </View>
            {user?.username && (
              <Text
                style={{ fontSize: 14, color: `${colors.primaryForeground}CC`, marginTop: 3 }}
                numberOfLines={1}
              >
                @{user?.username}
              </Text>
            )}
            {user?.email && (
              <Text
                style={{ fontSize: 14, color: `${colors.primaryForeground}CC`, marginTop: 2 }}
                numberOfLines={1}
              >
                {user?.email}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

export default function ProfileScreen() {
  const { user, logout, getProfile, loading } = useUser();
  const { colors, theme } = useTheme();
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const { updateInfo, isUpdateAvailable, currentVersion } = useAppUpdate();

  useEffect(() => {
    const getUser = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!user && token) {
        getProfile();
      }
    };
    getUser();
  }, [user, getProfile]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(tabs)/home');
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          gap: 12,
        }}
      >
        <ActivityIndicator size='small' color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Loading profile…</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          user={user}
          colors={colors}
          onAvatarPress={() => router.push('/update-profile-picture')}
          onCameraPress={() => router.push('/update-profile-picture')}
        />

        <View style={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
          {isUpdateAvailable && updateInfo && (
            <Card variant='default' style={{ borderColor: colors.primary, borderWidth: 1.5 }}>
              <Card.Header style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
                  <Card.Title>Update Available (v{updateInfo.version})</Card.Title>
                </View>
                {updateInfo.critical && (
                  <View style={{ backgroundColor: `${colors.destructive}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: colors.destructive, fontSize: 11, fontWeight: 'bold' }}>CRITICAL</Text>
                  </View>
                )}
              </Card.Header>
              <Card.Content style={{ gap: 12 }}>
                {updateInfo.releaseNotes && (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 2 }}>What's New:</Text>
                    {updateInfo.releaseNotes.split('\n').map(line => line.trim()).filter(line => line.length > 0).map((line, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Text style={{ color: colors.primary, fontSize: 13, lineHeight: 18 }}>•</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18, flex: 1 }}>
                          {line.replace(/^[-\*•\s]+/, '')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {updateInfo.downloadUrl && (
                  <TouchableOpacity
                    onPress={() => updateInfo.downloadUrl && Linking.openURL(updateInfo.downloadUrl)}
                    style={{
                      backgroundColor: colors.primary,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 14 }}>
                      Download & Install Update
                    </Text>
                  </TouchableOpacity>
                )}
              </Card.Content>
            </Card>
          )}
          <Card variant='default'>
            <Card.Header>
              <SectionHeader
                icon={
                  <Ionicons
                    name={theme === 'dark' ? 'moon' : 'sunny'}
                    size={20}
                    color={colors.primary}
                  />
                }
                title='Appearance'
                colors={colors}
              />
            </Card.Header>
            <Card.Content style={{ paddingTop: 8 }}>
              <ThemeToggle />
            </Card.Content>
          </Card>

          <Card variant='default'>
            <Card.Content style={{ paddingVertical: 8 }}>
              <SettingItem
                icon={<Feather name='user' size={18} color={colors.mutedForeground} />}
                title='Edit profile'
                subtitle='Update your personal information'
                onPress={() => router.push('/edit-profile')}
                colors={colors}
              />
              <SettingItem
                icon={<Feather name='music' size={18} color={colors.mutedForeground} />}
                title='Language preferences'
                subtitle='Set your preferred music languages'
                onPress={() => router.push('/music-language')}
                colors={colors}
              />
              <SettingItem
                icon={<Feather name='code' size={18} color={colors.mutedForeground} />}
                title='Developer info'
                subtitle='Meet the developer behind SyncVibe'
                onPress={() => setShowDeveloperModal(true)}
                colors={colors}
              />
              <SettingItem
                icon={<Feather name='log-out' size={18} color={colors.destructive} />}
                title='Logout'
                subtitle='Sign out of your account'
                onPress={handleLogout}
                colors={colors}
                isDestructive
                isLast
              />
            </Card.Content>
          </Card>

          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>SyncVibe v{currentVersion}</Text>
          </View>
        </View>
      </Animated.ScrollView>

      <DeveloperProfileModal isVisible={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} />
    </SafeAreaView>
  );
}