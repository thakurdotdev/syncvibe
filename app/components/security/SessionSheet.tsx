import SwipeableModal from '@/components/SwipeableModal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { formatDate, formatLastActive, sessionIcon, type DeviceSession } from '@/lib/sessions';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SheetLayout } from './SheetLayout';

type Target = { type: 'one'; session: DeviceSession } | { type: 'others'; count: number };

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
};

/**
 * Signs out one other device, or every other device at once. Give it a new `key` for each opening.
 */
export default function SessionSheet({
  isVisible,
  target,
  onClose,
  onConfirm,
}: {
  isVisible: boolean;
  target: Target | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // The caller shows the error; keep the sheet open so it can be retried.
    } finally {
      setBusy(false);
    }
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%' dragAnywhere>
      {target?.type === 'one' ? (
        <SheetLayout
          icon={sessionIcon(target.session)}
          title={target.session.name}
          description={target.session.detail ?? undefined}
        >
          <View style={[styles.details, { backgroundColor: colors.raised }]}>
            <DetailRow label='Signed in' value={formatDate(target.session.createdAt)} />
            <DetailRow label='Last seen' value={formatLastActive(target.session.lastActiveAt)} />
            {target.session.ipAddress ? (
              <DetailRow label='IP address' value={target.session.ipAddress} />
            ) : null}
          </View>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            Don’t recognise it? Sign it out, then change your password.
          </Text>
          <Button size='lg' variant='destructive' isLoading={busy} onPress={confirm}>
            Sign out this device
          </Button>
          <Button size='lg' variant='ghost' disabled={busy} onPress={onClose}>
            Cancel
          </Button>
        </SheetLayout>
      ) : target?.type === 'others' ? (
        <SheetLayout
          icon='log-out'
          tone='destructive'
          title='Sign out other devices?'
          description={`${target.count === 1 ? 'Your other device' : `Your ${target.count} other devices`} will need to sign in again. This phone stays signed in.`}
        >
          <Button size='lg' variant='destructive' isLoading={busy} onPress={confirm}>
            Sign out {target.count === 1 ? '1 device' : `${target.count} devices`}
          </Button>
          <Button size='lg' variant='ghost' disabled={busy} onPress={onClose}>
            Cancel
          </Button>
        </SheetLayout>
      ) : null}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  details: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 16,
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '500', flexShrink: 1, fontVariant: ['tabular-nums'] },
  note: { fontSize: 13.5, lineHeight: 19 },
});
