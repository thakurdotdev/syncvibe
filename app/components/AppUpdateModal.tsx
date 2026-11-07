import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import {
  cancelUpdate,
  hideUpdateSheet,
  initAppUpdates,
  installUpdate,
  openInstallPermissionSettings,
  openUpdateInBrowser,
  parseReleaseNotes,
  startUpdate,
  useAppUpdateStore,
  type UpdatePhase,
} from '@/stores/appUpdateStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

const MB = 1024 * 1024;
const formatMB = (bytes: number) => `${Math.round(bytes / MB)} MB`;

const PROGRESS_TRANSITION = {
  transitionProperty: 'width',
  transitionDuration: 1000,
  transitionTimingFunction: 'linear',
} as const;

const PHASE_ICONS: Record<UpdatePhase, keyof typeof Ionicons.glyphMap> = {
  idle: 'arrow-down',
  downloading: 'arrow-down',
  verifying: 'shield-checkmark',
  ready: 'checkmark',
  permission: 'lock-open',
  error: 'alert',
};

/** On its own so that progress ticks re-render this bar and not the whole sheet. */
const DownloadProgress = () => {
  const { colors } = useTheme();
  const bytesDownloaded = useAppUpdateStore((s) => s.bytesDownloaded);
  const totalBytes = useAppUpdateStore((s) => s.totalBytes);
  const percent = totalBytes > 0 ? Math.min(100, (bytesDownloaded / totalBytes) * 100) : 0;

  return (
    <View style={styles.progress}>
      <View
        accessibilityRole='progressbar'
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        style={[styles.track, { backgroundColor: colors.secondary }]}
      >
        <Animated.View
          style={[
            styles.fill,
            PROGRESS_TRANSITION,
            { backgroundColor: colors.primary, width: `${percent}%` },
          ]}
        />
      </View>
      <View style={styles.progressLabels}>
        <Text style={[styles.progressText, { color: colors.foreground }]}>
          {Math.round(percent)}%
        </Text>
        {totalBytes > 0 && (
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {formatMB(bytesDownloaded)} of {formatMB(totalBytes)}
          </Text>
        )}
      </View>
    </View>
  );
};

interface SheetButtonProps {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

const SheetButton = ({ label, onPress, primary }: SheetButtonProps) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole='button'
      style={[styles.button, { backgroundColor: primary ? colors.primary : colors.secondary }]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.buttonText,
          { color: primary ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
};

/**
 * The update flow, from "there's a new version" to Android's installer. A short sheet the app can
 * sit behind: closing it never stops the download, which belongs to the system. A critical update
 * is the one case it can't be closed.
 */
export const AppUpdateModal: React.FC = () => {
  const { colors } = useTheme();
  const latest = useAppUpdateStore((s) => s.latest);
  const phase = useAppUpdateStore((s) => s.phase);
  const sheetVisible = useAppUpdateStore((s) => s.sheetVisible);
  const waitingForNetwork = useAppUpdateStore((s) => s.waitingForNetwork);
  const errorMessage = useAppUpdateStore((s) => s.errorMessage);

  useEffect(() => initAppUpdates(), []);

  if (!latest) return null;

  const critical = latest.critical;
  const size = Number(latest.fileSize) || 0;
  const details = `Version ${latest.version}${size ? ` · ${formatMB(size)}` : ''}`;
  const copy: Record<UpdatePhase, { title: string; subtitle: string }> = {
    idle: { title: critical ? 'Update required' : 'Update available', subtitle: details },
    downloading: {
      title: 'Downloading update',
      subtitle: waitingForNetwork
        ? 'Waiting for a connection…'
        : critical
          ? 'This takes a minute or two.'
          : 'You can keep using SyncVibe.',
    },
    verifying: { title: 'Checking the download', subtitle: 'This only takes a moment.' },
    ready: { title: 'Ready to install', subtitle: 'Android will ask you to confirm.' },
    permission: {
      title: 'One more step',
      subtitle: 'Turn on “Allow from this source” for SyncVibe, then come back.',
    },
    error: { title: "Update didn't finish", subtitle: errorMessage ?? 'Please try again.' },
  };
  const notes = phase === 'idle' || phase === 'ready' ? parseReleaseNotes(latest.releaseNotes) : [];
  const isError = phase === 'error';

  return (
    <SwipeableModal
      isVisible={sheetVisible}
      onClose={hideUpdateSheet}
      dismissible={!critical}
      dragAnywhere={notes.length === 0}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.icon,
              { backgroundColor: isError ? colors.destructive : colors.primary },
            ]}
          >
            {phase === 'verifying' ? (
              <ActivityIndicator size='small' color={colors.primaryForeground} />
            ) : (
              <Ionicons name={PHASE_ICONS[phase]} size={22} color={colors.primaryForeground} />
            )}
          </View>
          <View style={styles.headerText} accessibilityLiveRegion='polite'>
            <Text style={[styles.title, { color: colors.foreground }]}>{copy[phase].title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {copy[phase].subtitle}
            </Text>
          </View>
        </View>

        {notes.length > 0 && (
          <ScrollView style={styles.notes} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {notes.map((line, i) => (
              <Text key={i} style={[styles.note, { color: colors.mutedForeground }]}>
                {line}
              </Text>
            ))}
          </ScrollView>
        )}

        {phase === 'downloading' && <DownloadProgress />}

        <View style={styles.actions}>
          {phase === 'idle' && (
            <>
              {!critical && <SheetButton label='Not now' onPress={hideUpdateSheet} />}
              <SheetButton label='Update' onPress={startUpdate} primary />
            </>
          )}
          {phase === 'downloading' && (
            <>
              <SheetButton label='Cancel' onPress={cancelUpdate} />
              {!critical && <SheetButton label='Hide' onPress={hideUpdateSheet} primary />}
            </>
          )}
          {phase === 'ready' && (
            <>
              {!critical && <SheetButton label='Later' onPress={hideUpdateSheet} />}
              <SheetButton label='Install' onPress={installUpdate} primary />
            </>
          )}
          {phase === 'permission' && (
            <>
              {!critical && <SheetButton label='Later' onPress={hideUpdateSheet} />}
              <SheetButton label='Open settings' onPress={openInstallPermissionSettings} primary />
            </>
          )}
          {isError && (
            <>
              {!critical && <SheetButton label='Close' onPress={hideUpdateSheet} />}
              <SheetButton label='Try again' onPress={startUpdate} primary />
            </>
          )}
        </View>

        {isError && latest.downloadUrl && (
          <Text
            onPress={openUpdateInBrowser}
            accessibilityRole='link'
            style={[styles.browserLink, { color: colors.mutedForeground }]}
          >
            Download from the browser instead
          </Text>
        )}
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 13.5, lineHeight: 19 },
  notes: { maxHeight: 168, flexGrow: 0 },
  note: { fontSize: 14, lineHeight: 21, marginBottom: 6 },
  progress: { gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  browserLink: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
});

export default AppUpdateModal;
