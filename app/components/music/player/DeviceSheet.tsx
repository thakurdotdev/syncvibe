import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { SettingsGroup, SettingsRow } from '@/components/profile/SettingsGroup';
import { SheetLayout } from '@/components/security/SheetLayout';
import { useTheme } from '@/context/ThemeContext';
import { transferTo } from '@/lib/player';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { usePlayerSessionStore, useRemoteDevice } from '@/stores/playerSessionStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

/*
 * Which of your devices plays. Every device you're signed in on with SyncVibe open is listed;
 * choosing one moves playback there from the same spot.
 */

const DeviceSheet = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const { colors } = useTheme();
  const devices = usePlayerSessionStore((s) => s.devices);
  const deviceId = usePlayerSessionStore((s) => s.deviceId);
  const activeId = usePlayerSessionStore((s) => s.playback?.active?.deviceId);

  // This phone first, then the rest by name.
  const sorted = [...devices].sort((a, b) => {
    if (a.deviceId === deviceId) return -1;
    if (b.deviceId === deviceId) return 1;
    return a.name.localeCompare(b.name);
  });

  const pick = (id: string) => {
    onClose();
    if (id !== activeId) void transferTo(id);
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%' dragAnywhere>
      <SheetLayout
        icon='speaker'
        title='Play on'
        description={
          sorted.length > 1
            ? 'Your music moves to the device you choose, from the same spot.'
            : 'Open SyncVibe on another phone or in a browser, signed in, and it shows up here.'
        }
      >
        <SettingsGroup>
          {sorted.map((device) => {
            const isThis = device.deviceId === deviceId;
            const playing = device.deviceId === activeId;
            return (
              <SettingsRow
                key={device.deviceId}
                icon={device.mobile ? 'smartphone' : 'monitor'}
                label={isThis ? `This phone · ${device.name}` : device.name}
                detail={playing ? 'Playing' : isThis ? 'Play here' : undefined}
                onPress={() => pick(device.deviceId)}
                trailing={
                  playing ? (
                    <Feather name='volume-2' size={18} color={colors.foreground} />
                  ) : undefined
                }
              />
            );
          })}
        </SettingsGroup>
      </SheetLayout>
    </SwipeableModal>
  );
};

/**
 * Under the controls in the full player: which device plays, and the way to change it. Hidden
 * until the phone is connected to the shared player.
 */
export const PlayingOnRow = memo(function PlayingOnRow() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const live = usePlayerSessionStore((s) => s.live);
  const reachable = usePlayerSessionStore((s) => s.playback?.activeOnline !== false);
  const remote = useRemoteDevice();
  if (!live) return null;

  const label = remote
    ? reachable
      ? `Playing on ${remote.name}`
      : `${remote.name} isn't reachable right now`
    : 'This phone';

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${label}. Choose a device`}
        style={styles.row}
        hitSlop={6}
      >
        <Feather
          name={remote ? (remote.mobile ? 'smartphone' : 'monitor') : 'speaker'}
          size={14}
          color={remote ? colors.foreground : colors.mutedForeground}
        />
        <Text
          style={[styles.label, { color: remote ? colors.foreground : colors.mutedForeground }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name='chevron-forward' size={14} color={colors.mutedForeground} />
      </PressableScale>
      <DeviceSheet isVisible={open} onClose={() => setOpen(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  label: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
