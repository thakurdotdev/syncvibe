import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { CURRENT_APP_VERSION, showUpdateSheet, useAppUpdateStore } from '@/stores/appUpdateStore';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Shown only when a newer build exists: where to get back to the update sheet after "Not now". */
export const UpdateCard = memo(function UpdateCard() {
  const { colors } = useTheme();
  const latest = useAppUpdateStore((s) => s.latest);
  const isUpdateAvailable = useAppUpdateStore((s) => s.isUpdateAvailable);
  const phase = useAppUpdateStore((s) => s.phase);
  const percent = useAppUpdateStore((s) =>
    s.totalBytes > 0 ? Math.min(100, Math.round((s.bytesDownloaded / s.totalBytes) * 100)) : 0
  );

  if (!isUpdateAvailable || !latest) return null;

  const status =
    phase === 'downloading'
      ? `Downloading… ${percent}%`
      : phase === 'verifying'
        ? 'Checking the download…'
        : phase === 'ready' || phase === 'permission'
          ? 'Downloaded and ready to install'
          : phase === 'error'
            ? "The last attempt didn't finish"
            : `You're on ${CURRENT_APP_VERSION}`;
  const action = phase === 'ready' || phase === 'permission' ? 'Install' : 'View';

  return (
    <PressableScale
      onPress={showUpdateSheet}
      accessibilityRole='button'
      style={[styles.card, { backgroundColor: colors.accent }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary }]}>
        <Ionicons name='arrow-down' size={18} color={colors.primaryForeground} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.accentForeground }]}>
          Version {latest.version} is available
        </Text>
        <Text style={[styles.sub, { color: colors.accentForeground }]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: colors.primary }]}>
        <Text style={[styles.pillText, { color: colors.primaryForeground }]}>{action}</Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12.5, marginTop: 1, opacity: 0.85 },
  pill: { height: 34, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '700' },
});
