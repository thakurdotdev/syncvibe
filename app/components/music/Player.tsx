import { blurredArt } from '@/lib/artwork';
import { EASE_OUT, project } from '@/lib/motion';
import { openOrigin, orbOrigin, type MorphOrigin } from '@/lib/playerMorph';
import { SWIPE_DIRECTION_DECIDED } from '@/lib/swipe';
import { useTheme } from '@/context/ThemeContext';
import {
  setFullPlayerOpen,
  setOnOpenFullPlayer,
  useCurrentSong,
  useIsPlaying,
  useQueueCount,
  useQueueNeighbors,
} from '@/stores/playerStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  interpolate,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import NewPlayerDrawer from './NewPlayerDrawer';
import { PAUSED_SCALE } from './player/ArtworkCarousel';
import { PLAYER_HEADER_HEIGHT, PlayerHeader, TabType } from './player/PlayerHeader';
import { PlayerTab } from './player/PlayerTab';
import { QueueTab } from './player/QueueTab';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 500;
/** Share of the queue's travel a swipe must be heading past, on release, to open or close it. */
const QUEUE_COMMIT_DISTANCE = 0.15;
/** Shorter than this was a stray touch, however fast. */
const QUEUE_MIN_MOVE = 16;
/**
 * A pull on the queue list takes over after this much movement. Under Android's 8dp touch slop,
 * so it decides before the list starts to scroll or stretch.
 */
const PULL_SLOP = 6;
/** Height the header and the player's own rows need; the artwork takes whatever is left. */
const CHROME_HEIGHT = 350;
/** Space either side of the artwork. */
const ARTWORK_MARGIN = 16;
const MIN_ARTWORK = 180;

/** The cover's corners, as in ArtworkCarousel. */
const COVER_RADIUS = 18;
/** Corners the sheet takes on while you pull it down, so it already looks like it's leaving. */
const DRAG_RADIUS = 28;
/** The player's own content fades in over this part of the open, once there's room for it. */
const CONTENT_IN: [number, number] = [0.45, 0.92];

const lerp = (from: number, to: number, t: number) => {
  'worklet';
  return from + (to - from) * t;
};

const system = ReduceMotion.System;
// No overshoot: the sheet must never lift past the top and show the app behind it.
const BACKDROP_ENTER = FadeIn.duration(260).easing(EASE_OUT);
const BACKDROP_EXIT = FadeOut.duration(200).easing(EASE_OUT);
const OPEN = { duration: 440, dampingRatio: 1, reduceMotion: system } as const;
const CLOSE = { duration: 380, dampingRatio: 1, reduceMotion: system } as const;
const SNAP_BACK = { duration: 260, dampingRatio: 1, reduceMotion: system } as const;
const QUEUE_SETTLE = { duration: 300, dampingRatio: 1, reduceMotion: system } as const;

/** The artwork, blurred and heavily scrimmed, tints the page without hurting legibility. */
const Backdrop = ({ uri }: { uri?: string }) => {
  const { colors, theme } = useTheme();
  // Secondary text is foreground at 70%: these scrims keep it AA on any artwork colour.
  const scrim = theme === 'dark' ? 'D6' : 'E0';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      {uri ? (
        <Animated.Image
          key={uri}
          entering={BACKDROP_ENTER}
          exiting={BACKDROP_EXIT}
          {...blurredArt(uri, 28)}
          resizeMode='cover'
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.background}${scrim}` }]}
      />
    </View>
  );
};

export default function Player() {
  const { colors } = useTheme();
  const currentSong = useCurrentSong();
  const queueCount = useQueueCount();
  const { index: queueIndex, prev: prevSong, next: nextSong } = useQueueNeighbors();
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

  const isPlaying = useIsPlaying();
  /**
   * The player grows out of the deck and shrinks back into it: 0 is the shape it came from
   * (lib/playerMorph), 1 full screen. `dragY` is how far you've pulled it down while open.
   */
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  /** The shape it's growing from or shrinking into this time. */
  const origin = useSharedValue<MorphOrigin | null>(null);
  /** Where the cover sits in the full player, measured from its layout (not the screen). */
  const coverTop = useSharedValue(-1);
  const coverScale = useSharedValue(1);
  /** Mounted and drawn from the first frame of opening until the last of closing. */
  const shown = useSharedValue(false);
  const queueShown = useSharedValue(0);
  const queueOpen = useSharedValue(false);
  const startQueueShown = useSharedValue(0);
  const draggingQueue = useSharedValue(false);
  /** Which way this swipe is going isn't known yet: see SWIPE_DIRECTION_DECIDED. */
  const directionPending = useSharedValue(false);
  /** The queue list's scroll offset, so a pull on the list knows whether it starts at the top. */
  const queueScrollY = useSharedValue(0);
  const listTouchX = useSharedValue(0);
  const listTouchY = useSharedValue(0);
  /** How far the queue slides: from just below the screen up to under the header. */
  const queueTravel = screenHeight - insets.top - PLAYER_HEADER_HEIGHT;

  useEffect(() => {
    coverScale.set(isPlaying ? 1 : PAUSED_SCALE);
  }, [coverScale, isPlaying]);

  const openPlayer = useCallback(() => {
    setIsOpen(true);
    origin.set(openOrigin.get() ?? orbOrigin.get());
    dragY.set(0);
    shown.set(true);
    progress.set(withSpring(1, OPEN));
  }, [dragY, origin, progress, shown]);

  useEffect(() => {
    setOnOpenFullPlayer(openPlayer);
    return () => setOnOpenFullPlayer(null);
  }, [openPlayer]);

  useEffect(() => setFullPlayerOpen(isOpen), [isOpen]);

  const handleClosed = useCallback(() => {
    shown.set(false);
    dragY.set(0);
    setIsOpen(false);
    setActiveTab('player');
    queueShown.set(0);
    queueOpen.set(false);
  }, [dragY, queueOpen, queueShown, shown]);

  const animateClosed = useCallback(
    (velocity = 0) => {
      'worklet';
      // Into the orb wherever it opened from: that's where the song lives while it's closed.
      origin.set(orbOrigin.get() ?? origin.get());
      // A flick down carries into the shrink: speed in points becomes speed in progress.
      progress.set(
        withSpring(0, { ...CLOSE, velocity: -velocity / screenHeight }, (finished) => {
          if (finished) scheduleOnRN(handleClosed);
        })
      );
    },
    [handleClosed, origin, progress, screenHeight]
  );

  const showTab = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      queueOpen.set(tab === 'queue');
      queueShown.set(withSpring(tab === 'queue' ? 1 : 0, QUEUE_SETTLE));
    },
    [queueOpen, queueShown]
  );
  const openQueue = useCallback(() => showTab('queue'), [showTab]);

  const handleBack = useCallback(() => {
    if (activeTab === 'queue') showTab('player');
    else animateClosed();
  }, [activeTab, animateClosed, showTab]);

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(', ') || '',
    [currentSong]
  );

  const artworkSize = useMemo(() => {
    const room = screenHeight - insets.top - insets.bottom - CHROME_HEIGHT;
    return Math.min(screenWidth - ARTWORK_MARGIN * 2, Math.max(MIN_ARTWORK, room));
  }, [screenWidth, screenHeight, insets.top, insets.bottom]);

  /**
   * The player's vertical swipe. On the song, up brings the queue and down closes the player;
   * on the queue, down goes back to the song. Both follow the finger until release.
   */
  const makeVerticalGesture = useCallback(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-20, 20])
        .onStart((e) => {
          startY.set(dragY.get());
          startQueueShown.set(queueShown.get());
          draggingQueue.set(queueOpen.get());
          directionPending.set(!queueOpen.get());
        })
        .onUpdate((e) => {
          if (directionPending.get()) {
            if (Math.abs(e.translationY) < SWIPE_DIRECTION_DECIDED) return;
            directionPending.set(false);
            draggingQueue.set(e.translationY < 0);
          }
          if (draggingQueue.get()) {
            queueShown.set(clamp(startQueueShown.get() - e.translationY / queueTravel, 0, 1));
          } else if (e.translationY > 0 && progress.get() >= 1) {
            dragY.set(startY.get() + e.translationY);
          }
        })
        .onEnd((e, success) => {
          if (directionPending.get()) {
            // Barely moved before lifting: a flick can still say which way it was going.
            directionPending.set(false);
            draggingQueue.set(e.velocityY < 0);
          }
          if (draggingQueue.get()) {
            const wasOpen = queueOpen.get();
            const moved = wasOpen ? e.translationY : -e.translationY;
            const speed = wasOpen ? e.velocityY : -e.velocityY;
            // Where the swipe was going decides: an easy flick is enough, and pulling back cancels.
            const flip =
              success &&
              moved > QUEUE_MIN_MOVE &&
              moved + project(speed) > queueTravel * QUEUE_COMMIT_DISTANCE;
            const open = flip ? !wasOpen : wasOpen;
            queueOpen.set(open);
            queueShown.set(
              withSpring(open ? 1 : 0, { ...QUEUE_SETTLE, velocity: -e.velocityY / queueTravel })
            );
            if (flip) scheduleOnRN(setActiveTab, open ? 'queue' : 'player');
          } else if (
            success &&
            (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY)
          ) {
            animateClosed(e.velocityY);
          } else {
            dragY.set(withSpring(0, { ...SNAP_BACK, velocity: e.velocityY }));
          }
        }),
    [
      animateClosed,
      directionPending,
      dragY,
      draggingQueue,
      progress,
      queueOpen,
      queueShown,
      queueTravel,
      startQueueShown,
      startY,
    ]
  );

  // One instance per detector: a gesture object can't be attached to two views.
  const headerGesture = useMemo(() => makeVerticalGesture(), [makeVerticalGesture]);
  const songGesture = useMemo(() => makeVerticalGesture(), [makeVerticalGesture]);
  const queueGesture = useMemo(() => makeVerticalGesture(), [makeVerticalGesture]);
  // On the list itself: a pull down closes the queue, but only one that starts with the list at
  // its top. Started anywhere else it fails at once, so the list scrolls with no delay.
  const queueListGesture = useMemo(
    () =>
      makeVerticalGesture()
        .manualActivation(true)
        // Explicit worklets: the Babel plugin only finds callbacks on chains that start at `Gesture.`.
        .onTouchesDown((e, state) => {
          'worklet';
          const touch = e.allTouches[0];
          if (!touch || queueScrollY.get() > 1) {
            state.fail();
            return;
          }
          listTouchX.set(touch.absoluteX);
          listTouchY.set(touch.absoluteY);
        })
        .onTouchesMove((e, state) => {
          'worklet';
          const touch = e.allTouches[0];
          if (!touch) return;
          const dx = Math.abs(touch.absoluteX - listTouchX.get());
          const dy = touch.absoluteY - listTouchY.get();
          if (queueScrollY.get() > 1 || dy < -PULL_SLOP || (dx > PULL_SLOP && dx > dy)) {
            state.fail();
          } else if (dy > PULL_SLOP) {
            state.activate();
          }
        }),
    [listTouchX, listTouchY, makeVerticalGesture, queueScrollY]
  );

  /** Where the morph starts and ends when nothing was measured: a dot just above the tabs. */
  const fallback: MorphOrigin = useMemo(() => {
    const size = 44;
    const box = {
      x: (screenWidth - size) / 2,
      y: screenHeight - insets.bottom - 90,
      width: size,
      height: size,
      radius: size / 2,
    };
    return { box, art: box };
  }, [insets.bottom, screenHeight, screenWidth]);

  // The sheet is a window that grows from the deck's shape to the whole screen (its corners
  // with it). Only it changes size: the content inside keeps the screen's size and position,
  // so nothing in the player is laid out again while it moves.
  const sheetStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const { box } = origin.get() ?? fallback;
    const drag = dragY.get();
    return {
      left: lerp(box.x, 0, p),
      top: lerp(box.y, drag, p),
      width: lerp(box.width, screenWidth, p),
      height: lerp(box.height, screenHeight, p),
      borderRadius: lerp(box.radius, interpolate(drag, [0, 120], [0, DRAG_RADIUS], 'clamp'), p),
      display: shown.get() ? 'flex' : 'none',
    };
  });
  const sheetContentStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const { box } = origin.get() ?? fallback;
    return {
      opacity: interpolate(p, CONTENT_IN, [0, 1], 'clamp'),
      transform: [
        { translateX: -lerp(box.x, 0, p) },
        { translateY: -lerp(box.y, dragY.get(), p) + dragY.get() * p },
      ],
    };
  });
  // The cover flies between the deck's artwork and its place in the player.
  const flyingCoverStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const { art } = origin.get() ?? fallback;
    const size = artworkSize * coverScale.get();
    const top = insets.top + PLAYER_HEADER_HEIGHT + (coverTop.get() >= 0 ? coverTop.get() : 24);
    const target = {
      x: (screenWidth - size) / 2,
      y: top + (artworkSize - size) / 2 + dragY.get(),
    };
    return {
      opacity: shown.get() && p < 1 ? 1 : 0,
      left: lerp(art.x, target.x, p),
      top: lerp(art.y, target.y, p),
      width: lerp(art.width, size, p),
      height: lerp(art.height, size, p),
      borderRadius: lerp(art.radius, COVER_RADIUS, p),
    };
  });
  const onArtLayout = useCallback((top: number) => coverTop.set(top), [coverTop]);
  // The song is gone early in the move, so it never shows through the rising queue.
  const playerLayerStyle = useAnimatedStyle(() => {
    const shown = clamp(queueShown.get(), 0, 1);
    return {
      opacity: Math.max(0, 1 - shown * 2.5),
      transform: [{ translateY: shown * -48 }],
    };
  });
  const queueLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - clamp(queueShown.get(), 0, 1)) * queueTravel }],
  }));

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!shown.get() || progress.get() <= 0) return false;
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleBack, progress, shown]);

  if (!currentSong) return null;

  const backdropUri = currentSong.image?.[0]?.link || currentSong.image?.[1]?.link;
  const coverUri =
    currentSong.image?.[2]?.link || currentSong.image?.[1]?.link || currentSong.image?.[0]?.link;

  return (
    <>
      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: colors.background }]}>
        <Animated.View
          style={[
            styles.sheetContent,
            { width: screenWidth, height: screenHeight, paddingTop: insets.top },
            sheetContentStyle,
          ]}
        >
          <Backdrop uri={backdropUri} />

          <GestureDetector gesture={headerGesture}>
            <View>
              <PlayerHeader
                activeTab={activeTab}
                queueShown={queueShown}
                onBack={handleBack}
                onOptionsPress={() => setPlayerDrawerOpen(true)}
              />
            </View>
          </GestureDetector>

          <View style={styles.content}>
            <Animated.View
              pointerEvents={activeTab === 'player' ? 'auto' : 'none'}
              style={[styles.layer, playerLayerStyle]}
            >
              <GestureDetector gesture={songGesture}>
                <View style={styles.content}>
                  <PlayerTab
                    currentSong={currentSong}
                    artistName={artistName}
                    artworkSize={artworkSize}
                    screenWidth={screenWidth}
                    queueIndex={queueIndex}
                    prevSong={prevSong}
                    nextSong={nextSong}
                    queueCount={queueCount}
                    bottomInset={insets.bottom}
                    isOpen={isOpen && activeTab === 'player'}
                    onOpenQueue={openQueue}
                    morph={progress}
                    onArtLayout={onArtLayout}
                  />
                </View>
              </GestureDetector>
            </Animated.View>

            <Animated.View
              pointerEvents={activeTab === 'queue' ? 'auto' : 'none'}
              style={[styles.layer, queueLayerStyle]}
            >
              <QueueTab
                playerOpen={isOpen}
                visible={activeTab === 'queue'}
                dragGesture={queueGesture}
                listGesture={queueListGesture}
                scrollOffset={queueScrollY}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Above the sheet: the cover on its way between the deck and the player. */}
      <Animated.View
        pointerEvents='none'
        style={[styles.flyingCover, { backgroundColor: colors.raised }, flyingCoverStyle]}
      >
        {coverUri ? (
          <Image source={{ uri: coverUri }} fadeDuration={0} style={StyleSheet.absoluteFill} />
        ) : null}
      </Animated.View>

      {playerDrawerOpen && (
        <NewPlayerDrawer
          isVisible={playerDrawerOpen}
          onClose={() => setPlayerDrawerOpen(false)}
          song={currentSong}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Its position, size and corners are animated (sheetStyle); the content keeps the screen's.
  sheet: {
    position: 'absolute',
    zIndex: 999,
    // Android draws by elevation too; keep the player above the app-wide bottom deck.
    elevation: 40,
    overflow: 'hidden',
  },
  sheetContent: { position: 'absolute', left: 0, top: 0 },
  flyingCover: { position: 'absolute', zIndex: 1000, elevation: 41, overflow: 'hidden' },
  content: { flex: 1 },
  layer: { ...StyleSheet.absoluteFill },
});
