import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type TabType = 'player' | 'queue';
export const PLAYER_HEADER_HEIGHT = 52;

interface PlayerHeaderProps {
  activeTab: TabType;
  onBack: () => void;
  onOptionsPress: () => void;
}

/** Close (or, from the queue, back to the song), what you're looking at, and song options. */
export const PlayerHeader = memo(function PlayerHeader({
  activeTab,
  onBack,
  onOptionsPress,
}: PlayerHeaderProps) {
  const { colors } = useTheme();
  const inQueue = activeTab === 'queue';

  return (
    <View style={styles.header}>
      <PressableScale
        onPress={onBack}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={6}
        accessibilityRole='button'
        accessibilityLabel={inQueue ? 'Back to now playing' : 'Close player'}
        style={styles.button}
      >
        <Ionicons
          name={inQueue ? 'chevron-back' : 'chevron-down'}
          size={26}
          color={colors.foreground}
        />
      </PressableScale>

      <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
        {inQueue ? 'Queue' : 'Now playing'}
      </Text>

      <PressableScale
        onPress={onOptionsPress}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={6}
        accessibilityRole='button'
        accessibilityLabel='Song options'
        style={styles.button}
      >
        <Ionicons name='ellipsis-horizontal' size={21} color={colors.foreground} />
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: PLAYER_HEADER_HEIGHT,
    paddingHorizontal: 10,
  },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '600' },
});
