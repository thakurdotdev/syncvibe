import { useTheme } from '@/context/ThemeContext';
import {
  setOnOpenFullPlayer,
  useCurrentSong,
  useNextSong,
  useQueueCount,
} from '@/stores/playerStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import NewPlayerDrawer from './NewPlayerDrawer';
import { PlayerHeader, TabType } from './player/PlayerHeader';
import { PlayerTab } from './player/PlayerTab';
import { QueueTab } from './player/QueueTab';

const SWIPE_THRESHOLD = 110;

const OPEN_SPRING = {
  damping: 24,
  stiffness: 240,
  mass: 0.75,
  overshootClamping: false,
};

const CLOSE_SPRING = {
  damping: 30,
  stiffness: 220,
  mass: 0.8,
  overshootClamping: true,
};

const SNAP_SPRING = {
  damping: 24,
  stiffness: 260,
  mass: 0.8,
};

export default function Player() {
  const { colors } = useTheme();
  const currentSong = useCurrentSong();
  const queueCount = useQueueCount();
  const nextSong = useNextSong();
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

  const translateY = useSharedValue(screenHeight);
  const startY = useSharedValue(0);

  const openPlayer = useCallback(() => {
    translateY.value = withSpring(0, OPEN_SPRING);
  }, [translateY]);

  useEffect(() => {
    setOnOpenFullPlayer(openPlayer);
    return () => setOnOpenFullPlayer(null);
  }, [openPlayer]);

  const closePlayer = useCallback(() => {
    translateY.value = withSpring(screenHeight, CLOSE_SPRING);
  }, [screenHeight, translateY]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(', ') || '',
    [currentSong]
  );

  const artworkSize = useMemo(
    () => Math.min(screenWidth - 48, screenHeight * 0.38, 340),
    [screenWidth, screenHeight]
  );

  const verticalGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .onStart(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = startY.value + e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > SWIPE_THRESHOLD || e.velocityY > 500) {
        scheduleOnRN(closePlayer);
      } else {
        translateY.value = withSpring(0, SNAP_SPRING);
      }
    });

  const expandedPlayerStyle = useAnimatedStyle(() => {
    const isHidden = translateY.value >= screenHeight;
    return {
      transform: [{ translateY: translateY.value }],
      opacity: interpolate(
        translateY.value,
        [0, screenHeight * 0.75, screenHeight],
        [1, 0.7, 0],
        Extrapolation.CLAMP
      ),
      display: isHidden ? 'none' : 'flex',
    };
  });

  useEffect(() => {
    const backAction = () => {
      if (translateY.value < screenHeight - 10) {
        closePlayer();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [closePlayer, screenHeight, translateY]);

  if (!currentSong) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.expandedPlayerContainer,
          expandedPlayerStyle,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
          },
        ]}
      >
        <GestureDetector gesture={verticalGesture}>
          <View>
            <PlayerHeader
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onClose={closePlayer}
              onOptionsPress={() => setPlayerDrawerOpen(true)}
              queueCount={queueCount}
            />
          </View>
        </GestureDetector>

        <View style={styles.contentContainer}>
          <View
            pointerEvents={activeTab === 'player' ? 'auto' : 'none'}
            style={[
              styles.tabLayer,
              {
                opacity: activeTab === 'player' ? 1 : 0,
                zIndex: activeTab === 'player' ? 1 : 0,
              },
            ]}
          >
            <PlayerTab
              currentSong={currentSong}
              artistName={artistName}
              artworkSize={artworkSize}
              nextSong={nextSong}
            />
          </View>

          <View
            pointerEvents={activeTab === 'queue' ? 'auto' : 'none'}
            style={[
              styles.tabLayer,
              {
                opacity: activeTab === 'queue' ? 1 : 0,
                zIndex: activeTab === 'queue' ? 1 : 0,
              },
            ]}
          >
            <QueueTab />
          </View>
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
  expandedPlayerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 999,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  tabLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  queueContainer: {
    flex: 1,
  },
});
