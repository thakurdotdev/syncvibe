import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  clamp,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

export type TabType = 'player' | 'queue';
export const PLAYER_HEADER_HEIGHT = 52;
/** How far each title travels while it fades: small, it's a hint of direction. */
const TITLE_SHIFT = 6;

interface PlayerHeaderProps {
  activeTab: TabType;
  /** How far the queue is up, 0 to 1. The header follows it, so it tracks a drag too. */
  queueShown: SharedValue<number>;
  onBack: () => void;
  onOptionsPress: () => void;
}

/** Close (or, from the queue, back to the song), what you're looking at, and song options. */
export const PlayerHeader = memo(function PlayerHeader({
  activeTab,
  queueShown,
  onBack,
  onOptionsPress,
}: PlayerHeaderProps) {
  const { colors } = useTheme();
  const inQueue = activeTab === 'queue';

  // One chevron turning from down (close) to left (back), rather than swapping icons.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clamp(queueShown.get(), 0, 1) * 90}deg` }],
  }));
  // The titles cross over in the middle, each moving the way the queue does: up when it opens.
  const playerTitleStyle = useAnimatedStyle(() => {
    const p = clamp(queueShown.get(), 0, 1);
    return {
      opacity: interpolate(p, [0, 0.5], [1, 0], 'clamp'),
      transform: [{ translateY: interpolate(p, [0, 0.5], [0, -TITLE_SHIFT], 'clamp') }],
    };
  });
  const queueTitleStyle = useAnimatedStyle(() => {
    const p = clamp(queueShown.get(), 0, 1);
    return {
      opacity: interpolate(p, [0.5, 1], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.5, 1], [TITLE_SHIFT, 0], 'clamp') }],
    };
  });

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
        <Animated.View style={chevronStyle}>
          <Ionicons name='chevron-down' size={26} color={colors.foreground} />
        </Animated.View>
      </PressableScale>

      <View style={styles.titles} pointerEvents='none'>
        <Animated.Text
          style={[styles.title, { color: colors.foreground }, playerTitleStyle]}
          accessibilityRole='header'
          accessibilityElementsHidden={inQueue}
          importantForAccessibility={inQueue ? 'no-hide-descendants' : 'auto'}
        >
          Now playing
        </Animated.Text>
        <Animated.Text
          style={[styles.title, styles.overlay, { color: colors.foreground }, queueTitleStyle]}
          accessibilityRole='header'
          accessibilityElementsHidden={!inQueue}
          importantForAccessibility={inQueue ? 'auto' : 'no-hide-descendants'}
        >
          Queue
        </Animated.Text>
      </View>

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
  titles: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0 },
});
