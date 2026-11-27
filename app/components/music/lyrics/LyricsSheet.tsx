import SwipeableModal from '@/components/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';
import { memo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LyricsView } from './LyricsView';
import { heardPosition } from './useLyricsPlayback';

/** The whole song's lyrics, for reading along. Opened from the lines under the cover. */
export const LyricsSheet = memo(function LyricsSheet({
  isVisible,
  onClose,
  songId,
  nextSongId,
  songName,
  onSeek,
}: {
  isVisible: boolean;
  onClose: () => void;
  songId: string | undefined;
  nextSongId?: string;
  songName?: string;
  onSeek?: (seconds: number) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose}>
      <View style={{ height: Math.round(height * 0.72) }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
            Lyrics
          </Text>
          {songName ? (
            <Text style={[styles.song, { color: colors.mutedForeground }]} numberOfLines={1}>
              {songName}
            </Text>
          ) : null}
        </View>
        <LyricsView
          songId={songId}
          nextSongId={nextSongId}
          getPosition={heardPosition}
          active={isVisible}
          onSeek={onSeek}
          bottomInset={insets.bottom}
          size='medium'
          fadeColor={colors.card}
        />
      </View>
    </SwipeableModal>
  );
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 6, gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  song: { fontSize: 13.5, fontWeight: '500' },
});
