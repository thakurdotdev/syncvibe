import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { SheetLayout } from '@/components/security/SheetLayout';
import { useTheme } from '@/context/ThemeContext';
import { transferTo } from '@/lib/player';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import {
  usePlayerSessionStore,
  usePlayingOn,
  type PlayerDevice,
} from '@/stores/playerSessionStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/*
 * Which of your devices plays. Every device you're signed in on with SyncVibe open is listed;
 * choosing one moves playback there from the same spot.
 */

const iconOf = (device: PlayerDevice) => (device.mobile ? 'smartphone' : 'monitor');
const kindOf = (device: PlayerDevice) => (device.mobile ? 'Phone' : 'Browser');

/** The device that plays, at the top: what it's doing, not a choice. */
const ActiveDevice = ({
  device,
  isThis,
  playing,
  offline,
}: {
  device: PlayerDevice;
  isThis: boolean;
  playing: boolean;
  offline: boolean;
}) => {
  const { colors } = useTheme();
  const state = offline ? 'Disconnected · paused' : playing ? 'Playing' : 'Paused';
  return (
    <View
      style={[styles.activeCard, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      accessible
      accessibilityLabel={`Playing on ${isThis ? 'this phone' : device.name}. ${state}`}
    >
      <View
        style={[styles.activeIcon, { backgroundColor: offline ? colors.muted : colors.foreground }]}
      >
        <Feather
          name={offline ? 'wifi-off' : iconOf(device)}
          size={19}
          color={offline ? colors.mutedForeground : colors.background}
        />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {isThis ? 'This phone' : device.name}
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {offline ? state : `${isThis ? device.name : kindOf(device)} · ${state}`}
        </Text>
      </View>
      <Feather
        name={offline ? 'volume-x' : 'volume-2'}
        size={18}
        color={offline ? colors.mutedForeground : colors.foreground}
      />
    </View>
  );
};

const DeviceRow = ({
  device,
  isThis,
  onPick,
}: {
  device: PlayerDevice;
  isThis: boolean;
  onPick: (id: string) => void;
}) => {
  const { colors } = useTheme();
  const action = isThis ? 'Play here' : 'Play there';
  return (
    <PressableScale
      onPress={() => onPick(device.deviceId)}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${action}: ${isThis ? 'this phone' : device.name}`}
      style={styles.row}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Feather name={iconOf(device)} size={17} color={colors.mutedForeground} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {isThis ? 'This phone' : device.name}
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {isThis ? device.name : kindOf(device)}
        </Text>
      </View>
      <View style={[styles.pill, { borderColor: colors.hairline, backgroundColor: colors.card }]}>
        <Text style={[styles.pillText, { color: colors.foreground }]}>{action}</Text>
      </View>
    </PressableScale>
  );
};

const DeviceSheet = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const { colors } = useTheme();
  const devices = usePlayerSessionStore((s) => s.devices);
  const deviceId = usePlayerSessionStore((s) => s.deviceId);
  const active = usePlayerSessionStore((s) => s.playback?.active ?? null);
  const playing = usePlayerSessionStore((s) => Boolean(s.playback?.timeline.playing));
  const { offline } = usePlayingOn();

  // The device playing on top; the rest with this phone first, then by name.
  const activeId = active?.deviceId;
  const activeDevice = activeId ? (devices.find((d) => d.deviceId === activeId) ?? active) : null;
  const others = devices
    .filter((d) => d.deviceId !== activeId)
    .sort((a, b) => {
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
          others.length > 0
            ? 'Your music moves to the device you choose, from the same spot.'
            : undefined
        }
      >
        {activeDevice ? (
          <View>
            <Text style={[styles.section, { color: colors.mutedForeground }]}>Playing on</Text>
            <ActiveDevice
              device={activeDevice}
              isThis={activeId === deviceId}
              playing={playing}
              offline={offline}
            />
          </View>
        ) : null}
        {others.length > 0 ? (
          <View>
            <Text style={[styles.section, { color: colors.mutedForeground }]}>
              {activeDevice ? 'Move it to' : 'Your devices'}
            </Text>
            {others.map((device) => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                isThis={device.deviceId === deviceId}
                onPick={pick}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: colors.hairline }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name='monitor' size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.rowName, { color: colors.foreground }]}>
              No other devices right now
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Open SyncVibe in a browser or on another phone, signed in, and you can play there from
              here.
            </Text>
          </View>
        )}
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
  const deviceCount = usePlayerSessionStore((s) => s.devices.length);
  const { remote, offline, deviceId } = usePlayingOn();
  if (!live) return null;

  if (!remote) {
    const label = deviceCount > 1 ? `This phone · ${deviceCount} devices` : 'This phone';
    return (
      <>
        <PressableScale
          onPress={() => setOpen(true)}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={`Playing on this phone. Choose a device`}
          style={styles.local}
          hitSlop={6}
        >
          <Feather name='speaker' size={14} color={colors.mutedForeground} />
          <Text style={[styles.localLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {label}
          </Text>
          <Ionicons name='chevron-forward' size={14} color={colors.mutedForeground} />
        </PressableScale>
        <DeviceSheet isVisible={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const label = offline ? `${remote.name} disconnected` : remote.name;
  return (
    <>
      <View
        style={[
          styles.remote,
          {
            backgroundColor: offline ? colors.muted : `${colors.foreground}0F`,
            borderColor: offline ? colors.hairline : `${colors.foreground}33`,
          },
        ]}
      >
        <PressableScale
          onPress={() => setOpen(true)}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={`${offline ? label : `Playing on ${label}`}. Choose a device`}
          style={styles.remoteMain}
          hitSlop={4}
        >
          <View>
            <Feather
              name={offline ? 'wifi-off' : iconOf(remote)}
              size={15}
              color={offline ? colors.mutedForeground : colors.foreground}
            />
            {!offline ? <View style={[styles.liveDot, { backgroundColor: colors.live }]} /> : null}
          </View>
          <Text style={[styles.remoteLabel, { color: colors.foreground }]} numberOfLines={1}>
            {offline ? (
              <>
                {label}
                <Text style={{ color: colors.mutedForeground }}> · paused</Text>
              </>
            ) : (
              <>
                <Text style={{ color: colors.mutedForeground }}>Playing on </Text>
                {label}
              </>
            )}
          </Text>
        </PressableScale>
        <PressableScale
          onPress={() => deviceId && void transferTo(deviceId)}
          scaleTo={BUTTON_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel='Play on this phone'
          style={[styles.hereBtn, { backgroundColor: colors.card, borderColor: colors.hairline }]}
          hitSlop={4}
        >
          <Text style={[styles.hereText, { color: colors.foreground }]}>Play here</Text>
        </PressableScale>
      </View>
      <DeviceSheet isVisible={open} onClose={() => setOpen(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15.5, fontWeight: '600' },
  detail: { fontSize: 12.5, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { fontSize: 15, fontWeight: '500' },
  pill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12.5, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  local: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  localLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  remote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  remoteMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  liveDot: { position: 'absolute', top: -3, right: -4, width: 6, height: 6, borderRadius: 3 },
  remoteLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  hereBtn: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  hereText: { fontSize: 12.5, fontWeight: '600' },
});
