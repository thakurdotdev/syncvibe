import { BUTTON_PRESS_SCALE, ENTER, project, SPRING_SNAP, STATE } from '@/lib/motion';
import { saveImageToGallery } from '@/utils/saveImage';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/ui/PressableScale';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** How far a drag has to be heading to close the viewer. */
const DISMISS_DISTANCE = 140;
const ZOOMED = 1.01;

type Size = { width: number; height: number };

/**
 * One photo: pinch to zoom around your fingers, double-tap to zoom in on a spot, drag to look
 * around. At normal size, dragging up or down closes the viewer, and sideways is left to the list,
 * which pages between photos. Runs entirely on the UI thread.
 */
const ZoomableImage = memo(function ZoomableImage({
  uri,
  size,
  dismissY,
  onZoomChange,
  onClose,
  onTap,
}: {
  uri: string;
  size: Size;
  dismissY: SharedValue<number>;
  onZoomChange: (zoomed: boolean) => void;
  onClose: () => void;
  onTap: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  // 0 undecided, 1 looking around a zoomed photo, 2 dragging to close.
  const mode = useSharedValue(0);

  const gesture = useMemo(() => {
    const settle = (nextScale: number, velocityX = 0, velocityY = 0) => {
      'worklet';
      const maxX = (size.width * (nextScale - 1)) / 2;
      const maxY = (size.height * (nextScale - 1)) / 2;
      scale.set(withSpring(nextScale, SPRING_SNAP));
      x.set(withSpring(clamp(x.get(), -maxX, maxX), { ...SPRING_SNAP, velocity: velocityX }));
      y.set(withSpring(clamp(y.get(), -maxY, maxY), { ...SPRING_SNAP, velocity: velocityY }));
      scheduleOnRN(onZoomChange, nextScale > ZOOMED);
    };

    const pinch = Gesture.Pinch()
      .onStart((e) => {
        savedScale.set(scale.get());
        savedX.set(x.get());
        savedY.set(y.get());
        focalX.set(e.focalX - size.width / 2);
        focalY.set(e.focalY - size.height / 2);
      })
      .onUpdate((e) => {
        const next = clamp(savedScale.get() * e.scale, 0.8, MAX_SCALE);
        const ratio = next / savedScale.get();
        scale.set(next);
        // Keeps the point between your fingers under your fingers.
        x.set(savedX.get() * ratio + focalX.get() * (1 - ratio));
        y.set(savedY.get() * ratio + focalY.get() * (1 - ratio));
      })
      .onEnd(() => {
        settle(clamp(scale.get(), 1, MAX_SCALE));
      });

    const pan = Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e) => {
        touchX.set(e.allTouches[0]?.absoluteX ?? 0);
        touchY.set(e.allTouches[0]?.absoluteY ?? 0);
        mode.set(0);
      })
      .onTouchesMove((e, state) => {
        if (mode.get() !== 0 || e.numberOfTouches > 1) return;
        const touch = e.allTouches[0];
        if (!touch) return;
        if (scale.get() > ZOOMED) {
          mode.set(1);
          state.activate();
          return;
        }
        const dx = Math.abs(touch.absoluteX - touchX.get());
        const dy = Math.abs(touch.absoluteY - touchY.get());
        if (dy > 10 && dy > dx) {
          mode.set(2);
          state.activate();
        } else if (dx > 10) {
          state.fail();
        }
      })
      .onTouchesUp((_e, state) => {
        if (mode.get() === 0) state.fail();
      })
      .onStart(() => {
        savedX.set(x.get());
        savedY.set(y.get());
      })
      .onUpdate((e) => {
        if (mode.get() === 1) {
          x.set(savedX.get() + e.translationX);
          y.set(savedY.get() + e.translationY);
        } else if (mode.get() === 2) {
          dismissY.set(e.translationY);
        }
      })
      .onEnd((e) => {
        if (mode.get() === 1) {
          settle(scale.get(), e.velocityX, e.velocityY);
        } else if (mode.get() === 2) {
          if (Math.abs(dismissY.get() + project(e.velocityY)) > DISMISS_DISTANCE) {
            const side = dismissY.get() + e.velocityY >= 0 ? 1 : -1;
            dismissY.set(
              withSpring(
                side * size.height,
                { ...SPRING_SNAP, overshootClamping: true, velocity: e.velocityY },
                (finished) => {
                  if (finished) scheduleOnRN(onClose);
                }
              )
            );
          } else {
            dismissY.set(withSpring(0, { ...SPRING_SNAP, velocity: e.velocityY }));
          }
        }
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e) => {
        if (scale.get() > ZOOMED) {
          x.set(withTiming(0, STATE));
          y.set(withTiming(0, STATE));
          scale.set(withTiming(1, STATE));
          scheduleOnRN(onZoomChange, false);
          return;
        }
        const maxX = (size.width * (DOUBLE_TAP_SCALE - 1)) / 2;
        const maxY = (size.height * (DOUBLE_TAP_SCALE - 1)) / 2;
        const toX = (size.width / 2 - e.x) * (DOUBLE_TAP_SCALE - 1);
        const toY = (size.height / 2 - e.y) * (DOUBLE_TAP_SCALE - 1);
        x.set(withTiming(clamp(toX, -maxX, maxX), STATE));
        y.set(withTiming(clamp(toY, -maxY, maxY), STATE));
        scale.set(withTiming(DOUBLE_TAP_SCALE, STATE));
        scheduleOnRN(onZoomChange, true);
      });

    const tap = Gesture.Tap().onEnd(() => {
      scheduleOnRN(onTap);
    });

    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));
  }, [
    dismissY,
    focalX,
    focalY,
    mode,
    onClose,
    onTap,
    onZoomChange,
    savedScale,
    savedX,
    savedY,
    scale,
    size.height,
    size.width,
    touchX,
    touchY,
    x,
    y,
  ]);

  const imageStyle = useAnimatedStyle(() => {
    const shrink = interpolate(
      Math.abs(dismissY.get()),
      [0, size.height],
      [1, 0.8],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: x.get() },
        { translateY: y.get() + dismissY.get() },
        { scale: scale.get() * shrink },
      ],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={size}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color='#fff' />
          </View>
        ) : null}
        <Animated.Image
          source={{ uri }}
          resizeMode='contain'
          fadeDuration={0}
          onLoadEnd={() => setLoading(false)}
          style={[size, imageStyle]}
        />
      </View>
    </GestureDetector>
  );
});

const IconButton = ({
  icon,
  label,
  onPress,
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  children?: React.ReactNode;
}) => (
  <PressableScale
    onPress={onPress}
    scaleTo={BUTTON_PRESS_SCALE}
    hitSlop={6}
    accessibilityRole='button'
    accessibilityLabel={label}
    style={styles.iconButton}
  >
    {children ?? (icon ? <Ionicons name={icon} size={22} color='#fff' /> : null)}
  </PressableScale>
);

type SaveState = 'idle' | 'saving' | 'saved';

const CONTROLS_FADE = { transitionProperty: 'opacity', transitionDuration: 150 } as const;

/** Full-screen photo viewer. Tap to hide the controls. */
const ImageGallery = ({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<Size | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dismissY = useSharedValue(0);
  const appeared = useSharedValue(0);

  useEffect(() => {
    appeared.set(withTiming(1, ENTER));
  }, [appeared]);

  useEffect(() => {
    setSaveState('idle');
  }, [index]);

  const toggleControls = useCallback(() => setControlsShown((shown) => !shown), []);

  const save = useCallback(async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      await saveImageToGallery(images[index]);
      setSaveState('saved');
    } catch (error) {
      setSaveState('idle');
      Alert.alert(
        "Couldn't save the photo",
        error instanceof Error && error.message === 'permission'
          ? 'Allow SyncVibe to add photos in your phone settings, then try again.'
          : 'Check your connection and try again.'
      );
    }
  }, [images, index, saveState]);

  const onPageEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (size) setIndex(Math.round(e.nativeEvent.contentOffset.x / size.width));
    },
    [size]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      appeared.get() *
      interpolate(
        Math.abs(dismissY.get()),
        [0, (size?.height ?? 800) / 2],
        [1, 0.15],
        Extrapolation.CLAMP
      ),
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: appeared.get() }));

  const renderPage = useCallback(
    ({ item }: { item: string }) =>
      size ? (
        <ZoomableImage
          uri={item}
          size={size}
          dismissY={dismissY}
          onZoomChange={setZoomed}
          onClose={onClose}
          onTap={toggleControls}
        />
      ) : null,
    [dismissY, onClose, size, toggleControls]
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: size?.width ?? 0,
      offset: (size?.width ?? 0) * i,
      index: i,
    }),
    [size?.width]
  );

  return (
    <Modal
      visible
      transparent
      animationType='none'
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <GestureHandlerRootView
        style={styles.root}
        onLayout={(e) =>
          setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <Animated.View style={[styles.root, contentStyle]}>
          {size ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              scrollEnabled={!zoomed}
              initialScrollIndex={initialIndex}
              getItemLayout={getItemLayout}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              renderItem={renderPage}
              onMomentumScrollEnd={onPageEnd}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
            />
          ) : null}

          <Animated.View
            pointerEvents={controlsShown ? 'box-none' : 'none'}
            style={[
              styles.controls,
              CONTROLS_FADE,
              { top: insets.top + 8 },
              controlsShown ? styles.controlsShown : styles.controlsHidden,
            ]}
          >
            <IconButton icon='close' label='Close photo' onPress={onClose} />
            {images.length > 1 ? (
              <Text style={styles.counter}>
                {index + 1} of {images.length}
              </Text>
            ) : null}
            <IconButton
              label={saveState === 'saved' ? 'Saved to gallery' : 'Save to gallery'}
              onPress={save}
            >
              {saveState === 'saving' ? (
                <ActivityIndicator color='#fff' />
              ) : (
                <Ionicons
                  name={saveState === 'saved' ? 'checkmark' : 'download-outline'}
                  size={22}
                  color='#fff'
                />
              )}
            </IconButton>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  controls: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsShown: { opacity: 1 },
  controlsHidden: { opacity: 0 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counter: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});

export default ImageGallery;
