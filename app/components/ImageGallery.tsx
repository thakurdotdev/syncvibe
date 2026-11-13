import { BUTTON_PRESS_SCALE, ENTER, project, SPRING_SNAP, STATE } from '@/lib/motion';
import { saveImageToGallery } from '@/utils/saveImage';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/ui/PressableScale';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
  preview,
  size,
  dismissY,
  onZoomChange,
  onClose,
  onTap,
}: {
  uri: string;
  /** The small version the conversation already showed, so there is never a blank screen. */
  preview?: string;
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
        <Animated.View style={[size, imageStyle]}>
          {loading && preview ? (
            <Image
              source={{ uri: preview }}
              resizeMode='contain'
              fadeDuration={0}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Image
            source={{ uri }}
            resizeMode='contain'
            fadeDuration={0}
            onLoadEnd={() => setLoading(false)}
            style={size}
          />
        </Animated.View>
        {loading && !preview ? (
          <View style={styles.loading} pointerEvents='none'>
            <ActivityIndicator color='#fff' />
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
});

export interface GalleryPhoto {
  url: string;
  /** The file's name, so it is saved as the right type. */
  name?: string;
  /** A smaller version that is probably already downloaded. */
  preview?: string;
  /** Who sent it and when, shown at the top. */
  title?: string;
  subtitle?: string;
  caption?: string | null;
}

const BarButton = ({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <PressableScale
    onPress={onPress}
    scaleTo={BUTTON_PRESS_SCALE}
    hitSlop={8}
    accessibilityRole='button'
    accessibilityLabel={label}
    style={styles.barButton}
  >
    {children}
  </PressableScale>
);

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'denied';

const SAVE_MESSAGE: Partial<Record<SaveState, string>> = {
  saved: 'Saved to your gallery',
  failed: "Couldn't save. Check your connection and try again.",
  denied: 'Allow SyncVibe to add photos in your phone settings.',
};
const SAVE_MESSAGE_MS = 2600;

const THUMB = 52;
const THUMB_GAP = 6;
const TOP_SCRIM = ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)'] as const;
const BOTTOM_SCRIM = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'] as const;
const CONTROLS_FADE = { transitionProperty: 'opacity', transitionDuration: 150 } as const;

/**
 * Full-screen photo viewer: who sent the photo at the top, its caption and the conversation's
 * other photos at the bottom. Tap the photo to hide everything but the photo.
 */
const ImageGallery = ({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: GalleryPhoto[];
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
  const pagerRef = useRef<FlatList<GalleryPhoto>>(null);
  const stripRef = useRef<FlatList<GalleryPhoto>>(null);

  const photo = photos[Math.min(index, photos.length - 1)];
  const many = photos.length > 1;

  useEffect(() => {
    appeared.set(withTiming(1, ENTER));
  }, [appeared]);

  // The note about saving goes away by itself.
  useEffect(() => {
    if (saveState === 'idle' || saveState === 'saving') return;
    const timer = setTimeout(() => setSaveState('idle'), SAVE_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [saveState]);

  const showPhoto = useCallback((next: number) => {
    setIndex(next);
    setSaveState('idle');
    stripRef.current?.scrollToIndex({ index: next, viewPosition: 0.5, animated: true });
  }, []);

  const toggleControls = useCallback(() => setControlsShown((shown) => !shown), []);

  const save = useCallback(async () => {
    if (saveState === 'saving' || !photo) return;
    setSaveState('saving');
    try {
      await saveImageToGallery(photo.url, photo.name);
      setSaveState('saved');
    } catch (error) {
      setSaveState(error instanceof Error && error.message === 'permission' ? 'denied' : 'failed');
    }
  }, [photo, saveState]);

  const onPageEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!size) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / size.width);
      if (next !== index) showPhoto(next);
    },
    [index, showPhoto, size]
  );

  const jumpTo = useCallback(
    (next: number) => {
      pagerRef.current?.scrollToIndex({ index: next, animated: false });
      showPhoto(next);
    },
    [showPhoto]
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
  // Arrives from slightly small, like the photo stepping forward out of the conversation.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: appeared.get(),
    transform: [{ scale: interpolate(appeared.get(), [0, 1], [0.96, 1]) }],
  }));
  // The bars get out of the way while the photo is being dragged off.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dismissY.get()), [0, 60], [1, 0], Extrapolation.CLAMP),
  }));

  const renderPage = useCallback(
    ({ item }: { item: GalleryPhoto }) =>
      size ? (
        <ZoomableImage
          uri={item.url}
          preview={item.preview}
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

  const renderThumb = useCallback(
    ({ item, index: i }: { item: GalleryPhoto; index: number }) => (
      <PressableScale
        onPress={() => jumpTo(i)}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
        accessibilityState={{ selected: i === index }}
        style={[styles.thumb, i === index ? styles.thumbActive : styles.thumbIdle]}
      >
        <Image
          source={{ uri: item.preview ?? item.url }}
          style={styles.thumbImage}
          fadeDuration={0}
        />
      </PressableScale>
    ),
    [index, jumpTo, photos.length]
  );

  const saveMessage = SAVE_MESSAGE[saveState];
  const visibility = controlsShown ? styles.shown : styles.hidden;

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
              ref={pagerRef}
              data={photos}
              horizontal
              pagingEnabled
              scrollEnabled={!zoomed}
              initialScrollIndex={initialIndex}
              getItemLayout={getItemLayout}
              keyExtractor={(item, i) => `${item.url}-${i}`}
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
            style={[StyleSheet.absoluteFill, styles.chrome, chromeStyle]}
          >
            <Animated.View pointerEvents='box-none' style={[CONTROLS_FADE, visibility]}>
              <LinearGradient
                pointerEvents='box-none'
                colors={TOP_SCRIM}
                style={[styles.topBar, { paddingTop: insets.top + 6 }]}
              >
                <BarButton label='Close photo' onPress={onClose}>
                  <Ionicons name='chevron-down' size={26} color='#fff' />
                </BarButton>
                <View style={styles.heading}>
                  {photo?.title ? (
                    <Text style={styles.title} numberOfLines={1}>
                      {photo.title}
                    </Text>
                  ) : null}
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {[photo?.subtitle, many ? `${index + 1} of ${photos.length}` : null]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                </View>
                <BarButton
                  label={saveState === 'saved' ? 'Saved to gallery' : 'Save to gallery'}
                  onPress={save}
                >
                  {saveState === 'saving' ? (
                    <ActivityIndicator color='#fff' />
                  ) : (
                    <Ionicons
                      name={saveState === 'saved' ? 'checkmark' : 'download-outline'}
                      size={23}
                      color='#fff'
                    />
                  )}
                </BarButton>
              </LinearGradient>
            </Animated.View>

            <Animated.View pointerEvents='box-none' style={[CONTROLS_FADE, visibility]}>
              <LinearGradient
                pointerEvents='box-none'
                colors={BOTTOM_SCRIM}
                style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}
              >
                {saveMessage ? (
                  <View style={styles.note} accessibilityLiveRegion='polite'>
                    <Text style={styles.noteText}>{saveMessage}</Text>
                  </View>
                ) : null}
                {photo?.caption ? (
                  <Text style={styles.caption} numberOfLines={4}>
                    {photo.caption}
                  </Text>
                ) : null}
                {many ? (
                  <FlatList
                    ref={stripRef}
                    data={photos}
                    horizontal
                    keyExtractor={(item, i) => `thumb-${item.url}-${i}`}
                    renderItem={renderThumb}
                    extraData={index}
                    initialScrollIndex={Math.max(0, initialIndex - 2)}
                    getItemLayout={(_, i) => ({
                      length: THUMB + THUMB_GAP,
                      offset: (THUMB + THUMB_GAP) * i,
                      index: i,
                    })}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.strip}
                  />
                ) : null}
              </LinearGradient>
            </Animated.View>
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
  chrome: { justifyContent: 'space-between' },
  shown: { opacity: 1 },
  hidden: { opacity: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, paddingHorizontal: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  bottomBar: { paddingTop: 36, gap: 12 },
  caption: { color: '#fff', fontSize: 15, lineHeight: 21, paddingHorizontal: 16 },
  note: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  noteText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  strip: { paddingHorizontal: 16, gap: THUMB_GAP },
  thumb: { width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden', borderWidth: 2 },
  thumbActive: { borderColor: '#fff', opacity: 1 },
  thumbIdle: { borderColor: 'transparent', opacity: 0.5 },
  thumbImage: { width: '100%', height: '100%' },
});

export default ImageGallery;
