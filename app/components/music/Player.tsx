import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT } from '@/lib/motion';
import {
  setOnOpenFullPlayer,
  useCurrentSong,
  useQueueCount,
  useQueueNeighbors,
} from '@/stores/playerStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import NewPlayerDrawer from './NewPlayerDrawer';
import { PlayerHeader, TabType } from './player/PlayerHeader';
import { PlayerTab } from './player/PlayerTab';
import { QueueTab } from './player/QueueTab';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 500;
/** Height the player's own rows need; the artwork takes whatever is left. */
const CHROME_HEIGHT = 400;
const MIN_ARTWORK = 180;

const system = ReduceMotion.System;
// No overshoot: the sheet must never lift past the top and show the app behind it.
const OPEN = { duration: 320, dampingRatio: 1, reduceMotion: system } as const;
const CLOSE = { duration: 260, dampingRatio: 1, reduceMotion: system } as const;
const SNAP_BACK = { duration: 260, dampingRatio: 1, reduceMotion: system } as const;
const SWITCH = { duration: 200, easing: EASE_OUT, reduceMotion: system } as const;

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
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(260)}
          source={{ uri }}
          blurRadius={28}
          resizeMode='cover'
          fadeDuration={0}
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

  const openPlayer = useCallback(() => {
    setIsOpen(true);
    translateY.set(withSpring(0, OPEN));
  }, [translateY]);

  useEffect(() => {
    setOnOpenFullPlayer(openPlayer);
    return () => setOnOpenFullPlayer(null);
  }, [openPlayer]);

  const handleClosed = useCallback(() => {
    setIsOpen(false);
    setActiveTab('player');
    queueShown.set(0);
  }, [queueShown]);

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
      queueShown.set(withTiming(tab === 'queue' ? 1 : 0, SWITCH));
    },
    [queueShown]
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
    return Math.min(screenWidth - 48, Math.max(MIN_ARTWORK, room));
  }, [screenWidth, screenHeight, insets.top, insets.bottom]);

  // One instance per detector: a gesture object can't be attached to two views.
  const makeDismissGesture = () =>
    Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-20, 20])
      .onStart(() => {
        startY.set(translateY.get());
      })
      .onUpdate((e) => {
        if (e.translationY > 0) translateY.set(startY.get() + e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
          animateClosed(e.velocityY);
        } else {
          translateY.set(withSpring(0, { ...SNAP_BACK, velocity: e.velocityY }));
        }
      });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
    display: translateY.get() >= screenHeight ? 'none' : 'flex',
  }));
  const playerLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - queueShown.get(),
    transform: [{ scale: 1 - queueShown.get() * 0.03 }],
  }));
  const queueLayerStyle = useAnimatedStyle(() => ({
    opacity: queueShown.get(),
    transform: [{ translateY: (1 - queueShown.get()) * 16 }],
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

        <GestureDetector gesture={makeDismissGesture()}>
          <View>
            <PlayerHeader
              activeTab={activeTab}
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
              dismissGesture={makeDismissGesture()}
              onOpenQueue={openQueue}
            />
          </Animated.View>

          <Animated.View
            pointerEvents={activeTab === 'queue' ? 'auto' : 'none'}
            style={[styles.layer, queueLayerStyle]}
          >
            <QueueTab />
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
