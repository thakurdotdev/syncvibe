import SwipeableModal from '@/components/SwipeableModal';
import { SettingsRow } from '@/components/profile/SettingsGroup';
import { Button } from '@/components/ui/button';
import type { Passkey } from '@/lib/passkey';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SheetLayout } from './SheetLayout';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/**
 * What you can do with one passkey: rename it, or remove it after a confirmation step in the same
 * sheet. Give it a new `key` for each opening so it starts on the actions, not the confirmation.
 */
export default function PasskeyActionsSheet({
  isVisible,
  passkey,
  isLastWayToSignIn,
  onClose,
  onRename,
  onRemove,
}: {
  isVisible: boolean;
  passkey: Passkey | null;
  /** Removing it leaves only Google sign-in, so the warning says so. */
  isLastWayToSignIn: boolean;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const name = passkey?.name || 'Passkey';

  const remove = async () => {
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%' dragAnywhere>
      {confirming ? (
        <SheetLayout
          icon='trash-2'
          tone='destructive'
          title='Remove this passkey?'
          description={
            isLastWayToSignIn
              ? `“${name}” is your only passkey. After removing it you’ll sign in with Google.`
              : `“${name}” will stop signing you in. You can also delete it from your password manager.`
          }
        >
          <Button size='lg' variant='destructive' isLoading={removing} onPress={remove}>
            Remove passkey
          </Button>
          <Button
            size='lg'
            variant='ghost'
            disabled={removing}
            onPress={() => setConfirming(false)}
          >
            Keep it
          </Button>
        </SheetLayout>
      ) : (
        <SheetLayout
          icon='key'
          title={name}
          description={
            passkey
              ? `${passkey.backedUp ? 'Synced across your devices' : 'Saved on one device'} · Added ${formatDate(passkey.createdAt)}`
              : undefined
          }
        >
          {/* SettingsRow brings its own 20pt inset; pull it back to the sheet's edges. */}
          <View style={styles.rows}>
            <SettingsRow icon='edit-2' label='Rename' onPress={onRename} />
            <SettingsRow
              icon='trash-2'
              label='Remove passkey'
              destructive
              onPress={() => setConfirming(true)}
            />
          </View>
        </SheetLayout>
      )}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  rows: { marginHorizontal: -20 },
});
