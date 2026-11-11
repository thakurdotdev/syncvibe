import SwipeableModal from '@/components/SwipeableModal';
import { SettingsRow } from '@/components/profile/SettingsGroup';
import { SheetLayout } from '@/components/security/SheetLayout';
import { Button } from '@/components/ui/button';
import type { GroupMember } from '@/stores/groupMusic/types';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

export type MemberRole = 'host' | 'cohost' | 'listener';

/**
 * What you can do about one person in the room. The host can make co-hosts or hand the room over;
 * the host and co-hosts can mute or remove listeners. Removing asks first, in the same sheet.
 * Give it a new `key` for each person so it opens on the actions, not the confirmation.
 */
export default function MemberActionsSheet({
  isVisible,
  member,
  role,
  muted,
  canPromote,
  canModerate,
  onClose,
  onSetCoHost,
  onMakeHost,
  onMute,
  onRemove,
}: {
  isVisible: boolean;
  member: GroupMember | null;
  role: MemberRole;
  muted: boolean;
  canPromote: boolean;
  canModerate: boolean;
  onClose: () => void;
  onSetCoHost: (enabled: boolean) => void;
  onMakeHost: () => void;
  onMute: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const name = member?.userName || 'This person';
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%' dragAnywhere>
      {confirming ? (
        <SheetLayout
          icon='user-x'
          tone='destructive'
          title={`Remove ${name}?`}
          description='They’ll leave the room on all their devices and can’t rejoin with the code. Invite them to let them back in.'
        >
          <Button size='lg' variant='destructive' onPress={act(onRemove)}>
            Remove from room
          </Button>
          <Button size='lg' variant='ghost' onPress={() => setConfirming(false)}>
            Keep them
          </Button>
        </SheetLayout>
      ) : (
        <SheetLayout
          icon={role === 'cohost' ? 'shield' : 'user'}
          title={name}
          description={
            (role === 'cohost' ? 'Co-host' : 'Listening') + (muted ? ' · Muted in chat' : '')
          }
        >
          {/* SettingsRow brings its own 20pt inset; pull it back to the sheet's edges. */}
          <View style={styles.rows}>
            {canPromote && (
              <>
                <SettingsRow
                  icon={role === 'cohost' ? 'shield-off' : 'shield'}
                  label={role === 'cohost' ? 'Remove as co-host' : 'Make co-host'}
                  detail={role === 'cohost' ? undefined : 'Controls playback and the queue'}
                  onPress={act(() => onSetCoHost(role !== 'cohost'))}
                />
                <SettingsRow
                  icon='star'
                  label='Make host'
                  detail='You stay on as a co-host'
                  onPress={act(onMakeHost)}
                />
              </>
            )}
            {canModerate && (
              <>
                <SettingsRow
                  icon={muted ? 'message-circle' : 'slash'}
                  label={muted ? 'Let them chat' : 'Mute in chat'}
                  detail={muted ? undefined : 'They keep listening'}
                  onPress={act(() => onMute(!muted))}
                />
                <SettingsRow
                  icon='user-x'
                  label='Remove from room'
                  destructive
                  onPress={() => setConfirming(true)}
                />
              </>
            )}
          </View>
        </SheetLayout>
      )}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  rows: { marginHorizontal: -20 },
});
