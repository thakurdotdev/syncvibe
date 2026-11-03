import { TAB_BAR_HEIGHT } from '@/components/music/UnifiedBottomDeck';
import { useTheme } from '@/context/ThemeContext';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export { TAB_BAR_HEIGHT };

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          lazy: true,
          animation: 'none',
          freezeOnBlur: true,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name='home/index' options={{ title: 'Home' }} />
        <Tabs.Screen name='group-music/index' options={{ title: 'Group Music' }} />
        <Tabs.Screen name='playlist/index' options={{ title: 'Playlist' }} />
        <Tabs.Screen name='chat/index' options={{ title: 'Message' }} />
        <Tabs.Screen name='profile/index' options={{ title: 'Profile' }} />
      </Tabs>

      {/* The bottom deck is rendered app-wide by components/shell/GlobalBottomDeck. */}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
