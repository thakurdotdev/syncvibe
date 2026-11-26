import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import {
  clearSleepTimer,
  setSleepTimerMinutes,
  setSleepTimerSongs,
  sleepTimerLabel,
  useSleepTimer,
} from '@/stores/sleepTimerStore';
import { fonts } from '@/theme/typography';
import { Feather } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MINUTES = [15, 30, 45, 60, 90];
const minutesLabel = (m: number) => (m === 60 ? '1 hour' : `${m} minutes`);

const Row = ({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) => (
  <PressableScale
    scaleTo={ROW_PRESS_SCALE}
    onPress={onPress}
    accessibilityRole='button'
    style={styles.row}
  >
    <Feather name={icon} size={19} color={color} />
    <Text style={[styles.rowText, { color }]}>{label}</Text>
  </PressableScale>
);

/** Pauses your music after a while, or when this song ends. */
export const SleepTimerSheet = memo(function SleepTimerSheet({
  isVisible,
  onClose,
}: {
  isVisible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const timer = useSleepTimer();
  const running = sleepTimerLabel(timer);

  const pick = (start: () => void, message: string) => {
    start();
    toast(message);
    onClose();
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} dragAnywhere>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
          Sleep timer
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {running
            ? timer.songsLeft === 1
              ? 'Pauses when this song ends'
              : `Pauses in ${running}`
            : 'Pause your music after a while'}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {MINUTES.map((m) => (
          <Row
            key={m}
            icon='clock'
            label={minutesLabel(m)}
            color={colors.foreground}
            onPress={() => pick(() => setSleepTimerMinutes(m), `Pausing in ${minutesLabel(m)}`)}
          />
        ))}
        <Row
          icon='music'
          label='End of this song'
          color={colors.foreground}
          onPress={() => pick(() => setSleepTimerSongs(1), 'Pausing when this song ends')}
        />
        {running ? (
          <Row
            icon='x-circle'
            label='Turn off timer'
            color={colors.destructive}
            onPress={() => pick(clearSleepTimer, 'Sleep timer off')}
          />
        ) : null}
      </View>
    </SwipeableModal>
  );
});

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4, paddingHorizontal: 12 },
  subtitle: { fontSize: 14, marginTop: 4, paddingHorizontal: 12 },
  divider: { height: 1, marginHorizontal: 12, marginTop: 16, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowText: { fontSize: 16, fontWeight: '500' },
});
