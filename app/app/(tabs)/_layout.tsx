import { useTheme } from '@/context/ThemeContext';
import { router, Tabs, usePathname } from 'expo-router';
import { Home, ListMusic, LucideProps, MessageCircle, Music, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TabButton = ({
  isFocused,
  onPress,
  label,
  icon: Icon,
}: {
  isFocused: boolean;
  onPress: () => void;
  label: string;
  icon: React.ComponentType<LucideProps>;
}) => {
  const { colors } = useTheme();
  const color = isFocused ? colors.primary : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      className='flex-1 items-center justify-center relative'
      style={{ paddingVertical: 12 }}
    >
      <View className='items-center justify-center rounded-full px-4 py-1'>
        <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 1.8} />

        <Text
          style={{
            color,
            fontWeight: isFocused ? '600' : '400',
            marginTop: 6,
            fontSize: 12,
          }}
          className='text-xs'
          numberOfLines={1}
          ellipsizeMode='tail'
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { colors } = useTheme();

  // Determine active tab based on pathname
  const isHomeActive = pathname.includes('/home');
  const isGroupMusicActive = pathname.includes('/group-music');
  const isProfileActive = pathname.includes('/profile');
  const isPlaylistActive = pathname.includes('/playlist');
  const isChatActive = pathname.includes('/chat');

  return (
    <View className='flex-1' style={{ backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Tabs.Screen
          name='home/index'
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name='group-music/index'
          options={{
            title: 'Group Music',
          }}
        />
        <Tabs.Screen
          name='playlist/index'
          options={{
            title: 'Playlist',
          }}
        />
        <Tabs.Screen
          name='chat/index'
          options={{
            title: 'Message',
          }}
        />
        <Tabs.Screen
          name='profile/index'
          options={{
            title: 'Profile',
          }}
        />
      </Tabs>

      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 75 + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            zIndex: 1000,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 5,
          },
        ]}
      >
        <View className='flex-row h-full'>
          <TabButton
            onPress={() => router.push('/home')}
            label='Home'
            icon={Home}
            isFocused={isHomeActive}
          />
          <TabButton
            onPress={() => router.push('/group-music')}
            label='Group'
            icon={Music}
            isFocused={isGroupMusicActive}
          />
          <TabButton
            onPress={() => router.push('/playlist')}
            label='Playlist'
            icon={ListMusic}
            isFocused={isPlaylistActive}
          />
          <TabButton
            onPress={() => router.push('/chat')}
            label='Chat'
            icon={MessageCircle}
            isFocused={isChatActive}
          />
          <TabButton
            onPress={() => router.push('/profile')}
            label='Profile'
            icon={User}
            isFocused={isProfileActive}
          />
        </View>
      </Animated.View>
    </View>
  );
}
