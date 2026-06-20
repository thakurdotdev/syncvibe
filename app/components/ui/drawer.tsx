import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  drawerHeight?: number | string;
  drawerStyle?: ViewStyle;
  overlayStyle?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  animationDuration?: number;
  overlayOpacity?: number;
  borderRadius?: number;
  handleIndicator?: boolean;
  darkMode?: boolean | 'auto';
  closeOnBackdropPress?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

export const Drawer: React.FC<BottomDrawerProps> = ({
  isOpen,
  onClose,
  children,
  drawerHeight = SCREEN_HEIGHT * 0.5,
  drawerStyle = {},
  overlayStyle = {},
  contentContainerStyle = {},
  animationDuration = 250,
  overlayOpacity = 0.7,
  borderRadius = 28,
  handleIndicator = true,
  darkMode = true,
  closeOnBackdropPress = true,
}) => {
  const systemColorScheme = useColorScheme();
  const isDarkMode = darkMode === 'auto' ? systemColorScheme === 'dark' : Boolean(darkMode);
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate actual drawer height
  const getDrawerHeight = useCallback((): number => {
    if (typeof drawerHeight === 'string') {
      return SCREEN_HEIGHT * (parseInt(drawerHeight, 10) / 100);
    }
    return drawerHeight as number;
  }, [drawerHeight]);

  // Animation values
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const gestureTranslateY = useSharedValue(0);
  const overlayOpacityValue = useSharedValue(0);

  // Open drawer animation - YouTube-like animation
  const openDrawer = useCallback(() => {
    setIsAnimating(true);

    translateY.value = withTiming(
      0,
      {
        duration: animationDuration,
        easing: Easing.bezier(0.17, 0.67, 0.23, 0.96),
      },
      () => {
        runOnJS(setIsAnimating)(false);
      }
    );

    overlayOpacityValue.value = withTiming(overlayOpacity, {
      duration: animationDuration,
      easing: Easing.bezier(0.17, 0.67, 0.23, 0.96),
    });
  }, [animationDuration, overlayOpacity]);

  // Close drawer animation - YouTube-like dismissal
  const closeDrawer = useCallback(() => {
    setIsAnimating(true);

    translateY.value = withTiming(
      SCREEN_HEIGHT,
      {
        duration: animationDuration,
        easing: Easing.bezier(0.33, 0.01, 0.66, 1),
      },
      () => {
        runOnJS(setIsAnimating)(false);
        runOnJS(onClose)();
        gestureTranslateY.value = 0;
      }
    );

    overlayOpacityValue.value = withTiming(0, {
      duration: animationDuration,
      easing: Easing.bezier(0.33, 0.01, 0.66, 1),
    });
  }, [animationDuration, onClose]);

  // Handle external isOpen prop change
  useEffect(() => {
    if (!isAnimating) {
      if (isOpen) {
        openDrawer();
      } else {
        // If already closed, don't animate
        if (translateY.value !== SCREEN_HEIGHT) {
          closeDrawer();
        }
      }
    }
  }, [isOpen, isAnimating, openDrawer, closeDrawer]);

  // New Gesture API implementation
  const panGesture = Gesture.Pan()
    .onStart(() => {
      // No need to store context, we can directly use the shared value
    })
    .onUpdate((event) => {
      if (event.translationY > 0) {
        // Only allow downward swipes
        // Add some resistance to the drag
        const dampenedDrag = event.translationY * 0.8;
        gestureTranslateY.value = dampenedDrag;
      }
    })
    .onEnd((event) => {
      if (event.translationY > SWIPE_THRESHOLD || event.velocityY > 500) {
        runOnJS(onClose)();
      } else {
        gestureTranslateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
          mass: 0.8,
        });
      }
    });

  // Animated styles
  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + gestureTranslateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacityValue.value,
  }));

  // Theme colors
  const colors = {
    background: isDarkMode ? '#121212' : '#FFFFFF',
    overlay: '#000000',
    handle: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)',
    shadow: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)',
  };

  return (
    <View style={styles.container} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop/Overlay */}
      <TouchableWithoutFeedback onPress={closeOnBackdropPress ? closeDrawer : undefined}>
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: colors.overlay },
            overlayAnimatedStyle,
            overlayStyle,
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.drawer,
            {
              height: getDrawerHeight(),
              backgroundColor: colors.background,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
              shadowColor: colors.shadow,
            },
            drawerAnimatedStyle,
            drawerStyle,
          ]}
        >
          {/* Handle indicator */}
          {handleIndicator && (
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: colors.handle }]} />
            </View>
          )}

          <View style={[styles.contentContainer, contentContainerStyle]}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 100,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
});
