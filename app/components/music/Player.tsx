import { blurredArt } from '@/lib/artwork';
import { EASE_OUT, project } from '@/lib/motion';
import { SWIPE_DIRECTION_DECIDED } from '@/lib/swipe';
import { useTheme } from '@/context/ThemeContext';
import {
  setFullPlayerOpen,
  setOnOpenFullPlayer,
  useCurrentSong,
  useQueueCount,
  useQueueNeighbors,
} from '@/stores/playerStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
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

const system = ReduceMotion.System;
// No overshoot: the sheet must never lift past the top and show the app behind it.
const BACKDROP_ENTER = FadeIn.duration(260).easing(EASE_OUT);
const BACKDROP_EXIT = FadeOut.duration(200).easing(EASE_OUT);
const OPEN = { duration: 320, dampingRatio: 1, reduceMotion: system } as const;
const CLOSE = { duration: 260, dampingRatio: 1, reduceMotion: system } as const;
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

  const translateY = useSharedValue(screenHeight);
  const startY = useSharedValue(0);
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

  const openPlayer = useCallback(() => {
    setIsOpen(true);
    translateY.set(withSpring(0, OPEN));
  }, [translateY]);

  useEffect(() => {
    setOnOpenFullPlayer(openPlayer);
    return () => setOnOpenFullPlayer(null);
  }, [openPlayer]);

  useEffect(() => setFullPlayerOpen(isOpen), [isOpen]);

  const handleClosed = useCallback(() => {
    setIsOpen(false);
    setActiveTab('player');
    queueShown.set(0);
    queueOpen.set(false);
  }, [queueOpen, queueShown]);

  const animateClosed = useCallback(
    (velocity = 0) => {
      'worklet';
      translateY.set(
        withSpring(screenHeight, { ...CLOSE, velocity }, (finished) => {
          if (finished) scheduleOnRN(handleClosed);
        })
      );
    },
    [handleClosed, screenHeight, translateY]
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
          startY.set(translateY.get());
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
          } else if (e.translationY > 0) {
            translateY.set(startY.get() + e.translationY);
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
            translateY.set(withSpring(0, { ...SNAP_BACK, velocity: e.velocityY }));
          }
        }),
    [
      animateClosed,
      directionPending,
      draggingQueue,
      queueOpen,
      queueShown,
      queueTravel,
      startQueueShown,
      startY,
      translateY,
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

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
    display: translateY.get() >= screenHeight ? 'none' : 'flex',
  }));
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
      if (translateY.get() >= screenHeight - 10) return false;
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleBack, screenHeight, translateY]);

  if (!currentSong) return null;

  const backdropUri = currentSong.image?.[0]?.link || currentSong.image?.[1]?.link;

  return (
    <>
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          { paddingTop: insets.top, backgroundColor: colors.background },
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
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    // Android draws by elevation too; keep the player above the app-wide bottom deck.
    elevation: 40,
    overflow: 'hidden',
  },
  content: { flex: 1 },
  layer: { ...StyleSheet.absoluteFill },
});
