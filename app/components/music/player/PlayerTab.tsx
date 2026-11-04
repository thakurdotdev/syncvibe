import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { type GestureType } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ArtworkCarousel } from './ArtworkCarousel';
import { Scrubber, secondary, Transport } from './PlayerControls';

const TEXT_ENTER = FadeIn.duration(180).easing(EASE_OUT);

interface PlayerTabProps {
  currentSong: Song;
  artistName: string;
  artworkSize: number;
  screenWidth: number;
  queueIndex: number;
  prevSong: Song | null;
  nextSong: Song | null;
  queueCount: number;
  bottomInset: number;
  isOpen: boolean;
  dismissGesture: GestureType;
  onOpenQueue: () => void;
}

/** Now playing: artwork, song, position, transport, and the way into the queue. */
export const PlayerTab = memo(function PlayerTab({
  currentSong,
  artistName,
  artworkSize,
  screenWidth,
  queueIndex,
  prevSong,
  nextSong,
  queueCount,
  bottomInset,
  isOpen,
  dismissGesture,
  onOpenQueue,
}: PlayerTabProps) {
  const { colors } = useTheme();
  const quiet = secondary(colors.foreground);
  const nextArt = nextSong?.image?.[1]?.link || nextSong?.image?.[0]?.link;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(14, bottomInset + 6) }]}>
      <View style={styles.artArea}>
        <ArtworkCarousel
          song={currentSong}
          prev={prevSong}
          next={nextSong}
          index={queueIndex}
          size={artworkSize}
          width={screenWidth}
          dismissGesture={dismissGesture}
        />
      </View>

      <View style={styles.panel}>
        <Animated.View key={currentSong.id} entering={TEXT_ENTER}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text style={[styles.artist, { color: quiet }]} numberOfLines={1}>
            {artistName}
          </Text>
        </Animated.View>

        <Scrubber active={isOpen} fallbackDuration={Number(currentSong.duration) || 0} />
        <Transport />

        <PressableScale
          onPress={onOpenQueue}
          scaleTo={0.98}
          accessibilityRole='button'
          accessibilityLabel={nextSong ? `Open queue. Up next: ${nextSong.name}` : 'Open queue'}
          style={[styles.upNext, { backgroundColor: `${colors.foreground}0F` }]}
        >
          {nextArt ? (
            <Image source={{ uri: nextArt }} style={styles.upNextArt} fadeDuration={0} />
          ) : (
            <View style={[styles.upNextArt, styles.upNextEmpty]}>
              <Ionicons name='musical-notes' size={16} color={quiet} />
            </View>
          )}
          <View style={styles.upNextText}>
            <Text style={[styles.upNextLabel, { color: quiet }]}>
              {nextSong ? 'Up next' : 'Queue'}
            </Text>
            <Text style={[styles.upNextName, { color: colors.foreground }]} numberOfLines={1}>
              {nextSong ? nextSong.name : 'Nothing after this song'}
            </Text>
          </View>
          {queueCount > 0 && (
            <Text style={[styles.upNextCount, { color: quiet }]}>{queueCount}</Text>
          )}
          <Ionicons name='list' size={19} color={colors.foreground} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  artArea: { flex: 1, justifyContent: 'center' },
  panel: { paddingHorizontal: 24, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.6 },
  artist: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 14,
    marginTop: 2,
  },
  upNextArt: { width: 38, height: 38, borderRadius: 8 },
  upNextEmpty: { alignItems: 'center', justifyContent: 'center' },
  upNextText: { flex: 1, minWidth: 0 },
  upNextLabel: { fontSize: 11, fontWeight: '600' },
  upNextName: { fontSize: 13.5, fontWeight: '600', marginTop: 1 },
  upNextCount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
