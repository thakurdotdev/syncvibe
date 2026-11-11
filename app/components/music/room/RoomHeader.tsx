import { ROW_PRESS_SCALE } from '@/lib/motion';
import { ConnectionBadge } from '@/components/music/group/ConnectionBadge';
import SwipeableModal from '@/components/SwipeableModal';
import { HeaderIconButton } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { fonts } from '@/theme/typography';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRoomControl } from './useRoomControl';

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  danger?: boolean;
  onPress: () => void;
};

/**
 * The room's less frequent actions in the app's standard bottom sheet (same motion and
 * drag-to-dismiss as every other sheet). The chosen action runs after the sheet has
 * finished closing, so two modals never animate over each other.
 */
const MoreSheet = ({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: Action[];
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const pending = useRef<(() => void) | null>(null);

  const handleClosed = () => {
    onClose();
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  return (
    <SwipeableModal isVisible={visible} onClose={handleClosed}>
      <View style={styles.sheet}>
        {actions.map((a) => (
          <PressableScale
            key={a.key}
            scaleTo={ROW_PRESS_SCALE}
            onPress={() => {
              pending.current = a.onPress;
              onClose();
            }}
            accessibilityRole='button'
            style={styles.sheetRow}
          >
            <View
              style={[
                styles.sheetIcon,
                { backgroundColor: a.danger ? `${colors.destructive}1F` : colors.raised },
              ]}
            >
              <Feather
                name={a.icon}
                size={18}
                color={a.danger ? colors.destructive : colors.foreground}
              />
            </View>
            <Text
              style={[
                styles.sheetLabel,
                { color: a.danger ? colors.destructive : colors.foreground },
              ]}
            >
              {a.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </SwipeableModal>
  );
};

const DELAY_STEP_MS = 25;

/**
 * Bluetooth speakers and some TVs play a moment late. This moves this phone's sound earlier (or
 * later) so it lands with everyone else's. Kept on this phone only.
 */
const SpeakerDelaySheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { colors } = useTheme();
  const offsetMs = useGroupPlaybackStore((s) => s.outputOffsetMs);
  const setOffset = useGroupPlaybackStore((s) => s.setOutputOffset);

  return (
    <SwipeableModal isVisible={visible} onClose={onClose}>
      <View style={styles.delaySheet}>
        <Text style={[styles.delayTitle, { color: colors.foreground }]}>Speaker delay</Text>
        <Text style={[styles.delayText, { color: colors.mutedForeground }]}>
          On Bluetooth and hearing an echo with others nearby? Raise this until your sound lines up
          with theirs.
        </Text>
        <View style={styles.delayRow}>
          <PressableScale
            onPress={() => setOffset(offsetMs - DELAY_STEP_MS)}
            accessibilityRole='button'
            accessibilityLabel='Play later'
            style={[styles.delayButton, { backgroundColor: colors.raised }]}
          >
            <Feather name='minus' size={20} color={colors.foreground} />
          </PressableScale>
          <Text
            style={[styles.delayValue, { color: colors.foreground }]}
            accessibilityLabel={`${offsetMs} milliseconds`}
          >
            {offsetMs > 0 ? '+' : ''}
            {offsetMs} ms
          </Text>
          <PressableScale
            onPress={() => setOffset(offsetMs + DELAY_STEP_MS)}
            accessibilityRole='button'
            accessibilityLabel='Play earlier'
            style={[styles.delayButton, { backgroundColor: colors.raised }]}
          >
            <Feather name='plus' size={20} color={colors.foreground} />
          </PressableScale>
        </View>
        {offsetMs !== 0 && (
          <PressableScale
            onPress={() => setOffset(0)}
            accessibilityRole='button'
            hitSlop={10}
            style={styles.delayReset}
          >
            <Text style={[styles.delayResetText, { color: colors.mutedForeground }]}>Reset</Text>
          </PressableScale>
        )}
      </View>
    </SwipeableModal>
  );
};

/**
 * Room header: name with live connection state and who's here on the left; invite and a
 * "more" sheet (QR code, share code, leave) on the right.
 */
export const RoomHeader = memo(function RoomHeader({
  onInvite,
  onShowQr,
  onShare,
  onLeave,
  onShowPeople,
}: {
  onInvite: () => void;
  onShowQr: () => void;
  onShare: () => void;
  onLeave: () => void;
  onShowPeople: () => void;
}) {
  const { colors } = useTheme();
  const group = useGroupSessionStore((s) => s.currentGroup);
  const members = useGroupSessionStore((s) => s.groupMembers);
  const [moreOpen, setMoreOpen] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const { setControlMode } = useGroupMusic();
  const { isHost, controlMode } = useRoomControl();

  if (!group) return null;

  const hostOnly = controlMode === 'host';
  const actions: Action[] = [
    { key: 'qr', label: 'Show QR code', icon: 'grid', onPress: onShowQr },
    { key: 'share', label: 'Share room code', icon: 'share-2', onPress: onShare },
    ...(isHost
      ? [
          {
            key: 'control',
            label: hostOnly ? 'Let everyone control playback' : 'Only hosts control playback',
            icon: hostOnly ? ('unlock' as const) : ('lock' as const),
            onPress: () => setControlMode(hostOnly ? 'everyone' : 'host'),
          },
        ]
      : []),
    {
      key: 'delay',
      label: 'Speaker delay',
      icon: 'bluetooth',
      onPress: () => setDelayOpen(true),
    },
    { key: 'leave', label: 'Leave room', icon: 'log-out', danger: true, onPress: onLeave },
  ];

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
            accessibilityRole='header'
          >
            {group.name}
          </Text>
          <ConnectionBadge />
        </View>
        <PressableScale
          onPress={onShowPeople}
          accessibilityRole='button'
          accessibilityLabel={`${members.length} in the room. Show people`}
          style={styles.people}
        >
          <View style={styles.faces}>
            {members.slice(0, 4).map((m, i) => (
              <Image
                key={String(m.userId)}
                source={{ uri: getProfileCloudinaryUrl(m.profilePic) }}
                style={[
                  styles.face,
                  {
                    borderColor: colors.background,
                    marginLeft: i ? -7 : 0,
                    backgroundColor: colors.muted,
                  },
                ]}
                fadeDuration={0}
              />
            ))}
          </View>
          <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {members.length} listening
          </Text>
        </PressableScale>
      </View>

      <View style={styles.actions}>
        <HeaderIconButton tone='primary' label='Invite friends' onPress={onInvite}>
          <Ionicons name='person-add' size={17} color={colors.primaryForeground} />
        </HeaderIconButton>
        <HeaderIconButton
          icon='ellipsis-horizontal'
          label='More room options'
          onPress={() => setMoreOpen(true)}
        />
      </View>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} actions={actions} />
      <SpeakerDelaySheet visible={delayOpen} onClose={() => setDelayOpen(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 12,
  },
  left: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.6, flexShrink: 1 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  faces: { flexDirection: 'row' },
  face: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  count: { fontSize: 12.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },

  sheet: { paddingHorizontal: 12, paddingBottom: 8, gap: 2 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 54,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLabel: { fontSize: 15.5, fontWeight: '600' },

  delaySheet: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  delayTitle: { fontFamily: fonts.displaySemibold, fontSize: 19 },
  delayText: { fontSize: 13.5, lineHeight: 19 },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 10,
  },
  delayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayValue: { minWidth: 96, textAlign: 'center', fontSize: 22, fontVariant: ['tabular-nums'] },
  delayReset: { alignSelf: 'center' },
  delayResetText: { fontSize: 13.5, fontWeight: '600' },
});
