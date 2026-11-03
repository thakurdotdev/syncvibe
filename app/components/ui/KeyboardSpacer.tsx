import { memo } from 'react';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Grows with the software keyboard, frame by frame, so whatever sits above it (a chat
 * composer) stays visible. Needed because the app draws edge-to-edge on Android, where
 * the window no longer resizes for the keyboard.
 *
 * Mount it only while its screen is focused: while mounted it takes over keyboard insets.
 */
export const KeyboardSpacer = memo(function KeyboardSpacer() {
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const style = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.height.value) }));
  return <Animated.View style={style} pointerEvents='none' />;
});
