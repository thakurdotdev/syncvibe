import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/context/ThemeContext';

const DISMISS_VELOCITY = 700;
const CLOSE_DURATION = 190;
const DRAG_REGION_HEIGHT = 72;
const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);

interface SwipeableModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  hideHandle?: boolean;
  backdropOpacity?: number;
  style?: ViewStyle;
  scrollable?: boolean;
  useScrollView?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Shared scroll offset for FlatList/ScrollView content rendered by the caller. */
  scrollOffset?: SharedValue<number>;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  /** Present as an edge-to-edge modal screen instead of a rounded bottom sheet. */
  fullScreen?: boolean;
}

const SwipeableModal: React.FC<SwipeableModalProps> = ({
  isVisible,
  onClose,
  children,
  maxHeight,
  hideHandle = false,
  backdropOpacity = 0.6,
  style,
  scrollable = false,
  useScrollView = false,
  onScroll,
  scrollOffset,
  keyboardAvoiding = true,
  keyboardVerticalOffset = 0,
  fullScreen = false,
}) => {
  const { colors, theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [modalMounted, setModalMounted] = useState(false);

  const progress = useSharedValue(0);
  const gestureY = useSharedValue(0);
  const keyboardInset = useSharedValue(0);
  const internalScrollOffset = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const sheetTop = useSharedValue(0);
  const dragEligible = useSharedValue(false);
  const gestureActive = useSharedValue(false);
  const closing = useSharedValue(0);
  const activeScrollOffset = scrollOffset ?? internalScrollOffset;
  const modalMountedRef = useRef(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Hidden modal instances are kept in many screens; avoid registering
    // keyboard listeners until a sheet is actually open.
    // Android resizes a full-screen modal through the window insets. Applying
    // a second JS-managed inset there causes the blank area left after the
    // keyboard closes. iOS needs the frame value to animate its sheet safely.
    if (!keyboardAvoiding || !isVisible || Platform.OS !== 'ios') return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const updateKeyboardHeight = (event: { endCoordinates: { height: number } }) => {
      keyboardInset.value = withTiming(Math.max(0, event.endCoordinates.height), {
        duration: 220,
      });
    };

    const showSubscription = Keyboard.addListener(showEvent, updateKeyboardHeight);
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardInset.value = withTiming(0, { duration: 180 });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardInset.value = withTiming(0, { duration: CLOSE_DURATION });
    };
  }, [keyboardAvoiding, isVisible, keyboardInset]);

  const resolvedMaxHeight =
    typeof maxHeight === 'number'
      ? maxHeight
      : typeof maxHeight === 'string' && maxHeight.endsWith('%')
        ? (parseFloat(maxHeight) / 100) * windowHeight
        : maxHeight === 'auto'
          ? windowHeight * 0.8
          : windowHeight * 0.8;

  const hasExplicitHeight = fullScreen || StyleSheet.flatten(style)?.height != null;
  const finishClose = useCallback(() => {
    modalMountedRef.current = false;
    closingRef.current = false;
    closing.value = 0;
    setModalMounted(false);
    onCloseRef.current();
  }, [closing]);

  const animateOpen = useCallback(() => {
    cancelAnimation(progress);
    cancelAnimation(gestureY);
    closing.value = 0;
    closingRef.current = false;
    gestureActive.value = false;
    gestureY.value = 0;
    progress.value = withSpring(1, {
      damping: 27,
      stiffness: 280,
      mass: 0.75,
      overshootClamping: true,
    });
  }, [progress, gestureY, closing, gestureActive]);

  const animateClose = useCallback(() => {
    if (!modalMountedRef.current || closingRef.current || closing.value === 1) return;

    closingRef.current = true;
    closing.value = 1;
    cancelAnimation(progress);
    cancelAnimation(gestureY);
    progress.value = withTiming(
      0,
      { duration: CLOSE_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(finishClose);
        }
      }
    );
    gestureY.value = withTiming(0, {
      duration: CLOSE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, gestureY, closing, finishClose]);

  useEffect(() => {
    if (isVisible) {
      modalMountedRef.current = true;
      closingRef.current = false;
      setModalMounted(true);
      keyboardInset.value = 0;
      const frame = requestAnimationFrame(animateOpen);
      return () => cancelAnimationFrame(frame);
    }

    if (modalMountedRef.current && !closingRef.current) {
      animateClose();
    }
  }, [isVisible, animateOpen, animateClose]);

  const handleInternalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      internalScrollOffset.value = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [internalScrollOffset, onScroll]
  );

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .failOffsetX([-36, 36])
    .onTouchesDown((event) => {
      'worklet';
      const touch = event.allTouches[0];
      touchStartY.value = touch?.absoluteY ?? 0;
      dragEligible.value = !!touch && touch.absoluteY <= sheetTop.value + DRAG_REGION_HEIGHT;
      gestureActive.value = false;
    })
    .onTouchesMove((event, stateManager) => {
      'worklet';
      if (!dragEligible.value) {
        stateManager.fail();
        return;
      }

      const touch = event.allTouches[0];
      if (!touch) return;

      const translationY = touch.absoluteY - touchStartY.value;
      const isAtTop = activeScrollOffset.value <= 1;

      // Let the list own upward scrolling and all drags that begin below its top.
      // The sheet can take over only for a downward pull from the top edge.
      if (!scrollable && translationY > 4) {
        stateManager.activate();
        gestureActive.value = true;
      } else if (scrollable && isAtTop && translationY > 4) {
        stateManager.activate();
        gestureActive.value = true;
      } else if (translationY < -4 || (scrollable && !isAtTop)) {
        stateManager.fail();
      }
    })
    .onTouchesUp((_, stateManager) => {
      'worklet';
      if (!gestureActive.value) stateManager.fail();
    })
    .onUpdate((e) => {
      'worklet';
      const translation = e.translationY;
      const resistance = Math.min(Math.abs(translation) / Math.max(resolvedMaxHeight, 1), 0.35);
      gestureY.value = translation > 0 ? translation * (1 - resistance) : translation * 0.12;
    })
    .onEnd((e) => {
      'worklet';
      gestureActive.value = false;
      if (closing.value === 1) return;

      const dismissDistance = Math.min(resolvedMaxHeight * 0.28, 220);
      const shouldDismiss = e.translationY > dismissDistance || e.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        closing.value = 1;
        progress.value = withTiming(
          0,
          { duration: CLOSE_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            'worklet';
            if (finished) scheduleOnRN(finishClose);
          }
        );
        gestureY.value = withTiming(0, {
          duration: CLOSE_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        gestureY.value = withSpring(0, { damping: 25, stiffness: 320, mass: 0.7 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [0, 1], [0, backdropOpacity], Extrapolation.CLAMP) *
      interpolate(
        Math.max(gestureY.value, 0),
        [0, resolvedMaxHeight],
        [1, 0.35],
        Extrapolation.CLAMP
      ),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(progress.value, [0, 1], [windowHeight, 0], Extrapolation.CLAMP) +
          gestureY.value,
      },
    ],
  }));

  const fixedKeyboardRootStyle = useAnimatedStyle(() => ({
    // An explicit-height sheet already resizes below. Adding padding here too
    // is what previously left a keyboard-sized blank area after dismissal.
    paddingBottom: 0,
  }));

  const fixedKeyboardSheetStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'ios' && hasExplicitHeight && keyboardInset.value > 0.5) {
      return {
        height: Math.max(0, Math.min(resolvedMaxHeight, windowHeight - keyboardInset.value)),
      };
    }

    // Do not return `height: undefined`: because this style is applied after
    // the sheet style it clears an explicit full-screen height.
    return {};
  });

  if (!modalMounted) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={() => animateClose()}
    >
      <GestureHandlerRootView style={styles.root}>
        {fullScreen && (
          <StatusBar
            translucent
            backgroundColor={colors.card}
            barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
          />
        )}
        <AnimatedKeyboardAvoidingView
          enabled={keyboardAvoiding && !hasExplicitHeight}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={[styles.keyboardRoot, fixedKeyboardRootStyle]}
        >
          <Pressable
            style={fullScreen ? styles.fullScreenBackdropTouchable : styles.backdropTouchable}
            onPress={animateClose}
          />

          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents='none' />

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  ...(fullScreen
                    ? {
                        height: resolvedMaxHeight,
                        maxHeight: resolvedMaxHeight,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingBottom: 0,
                      }
                    : { maxHeight: resolvedMaxHeight }),
                },
                sheetStyle,
                style,
                fixedKeyboardSheetStyle,
              ]}
              onLayout={(event) => {
                sheetTop.value = event.nativeEvent.layout.y;
              }}
            >
              {!hideHandle && (
                <View style={styles.handleContainer}>
                  <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
                </View>
              )}
              {scrollable && useScrollView ? (
                <ScrollView
                  onScroll={handleInternalScroll}
                  scrollEventThrottle={16}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps='handled'
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                  {children}
                </ScrollView>
              ) : (
                children
              )}
            </Animated.View>
          </GestureDetector>
        </AnimatedKeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  fullScreenBackdropTouchable: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  scrollView: {
    width: '100%',
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
});

export default React.memo(SwipeableModal);
