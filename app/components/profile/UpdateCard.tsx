import PressableScale from '@/components/ui/PressableScale';
import { useAppUpdate } from '@/context/AppUpdateContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Shown only when a newer build exists: what's new, and the ways to get it. */
export const UpdateCard = memo(function UpdateCard() {
  const { colors } = useTheme();
  const { updateInfo, isUpdateAvailable, currentVersion, showUpdateModal, openManualDownloadUrl } =
    useAppUpdate();
  const [expanded, setExpanded] = useState(false);

  const notes = useMemo(
    () =>
      (updateInfo?.releaseNotes || '')
        .split('\n')
        .map((l) => l.trim().replace(/^[-*•\s]+/, ''))
        .filter(Boolean),
    [updateInfo?.releaseNotes]
  );

  if (!isUpdateAvailable || !updateInfo) return null;
  const visible = expanded ? notes : notes.slice(0, 2);

  return (
    <View style={[styles.card, { backgroundColor: colors.accent }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.primary }]}>
          <Ionicons name='arrow-down' size={18} color={colors.primaryForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.accentForeground }]}>
            Version {updateInfo.version} is ready
          </Text>
          <Text style={[styles.sub, { color: colors.accentForeground }]}>
            You're on {currentVersion}
            {updateInfo.critical ? ' · important fixes' : ''}
          </Text>
        </View>
      </View>

      {visible.map((line, i) => (
        <Text
          key={i}
          style={[styles.note, { color: colors.accentForeground }]}
          numberOfLines={expanded ? undefined : 2}
        >
          • {line}
        </Text>
      ))}
      {notes.length > 2 && (
        <Text
          onPress={() => setExpanded((v) => !v)}
          style={[styles.more, { color: colors.primary }]}
          accessibilityRole='button'
        >
          {expanded ? 'Show less' : `Show ${notes.length - 2} more`}
        </Text>
      )}

      <View style={styles.actions}>
        <PressableScale
          onPress={showUpdateModal}
          accessibilityRole='button'
          style={[styles.primary, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Update now</Text>
        </PressableScale>
        {updateInfo.downloadUrl ? (
          <PressableScale
            onPress={openManualDownloadUrl}
            accessibilityRole='button'
            accessibilityLabel='Download the update in your browser'
            style={[styles.secondary, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Browser</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, fontWeight: '700' },
  sub: { fontSize: 12.5, marginTop: 1, opacity: 0.85 },
  note: { fontSize: 13, lineHeight: 18, opacity: 0.9 },
  more: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primary: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 14, fontWeight: '700' },
  secondary: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
