import PressableScale from '@/components/ui/PressableScale';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';

interface CreateOrJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string) => void;
  onJoinGroup: (id: string) => void;
  onScanQRCode: () => void;
  /** Which form to show first. */
  initialTab?: 'create' | 'join';
}

export const CreateOrJoinModal: React.FC<CreateOrJoinModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  onJoinGroup,
  onScanQRCode,
  initialTab = 'create',
}) => {
  const { colors } = useTheme();
  const [tabIndex, setTabIndex] = useState(initialTab === 'join' ? 1 : 0);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupId, setGroupId] = useState('');

  const handleCreate = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
      onClose();
    }
  };

  const handleJoin = () => {
    if (groupId.trim()) {
      onJoinGroup(groupId.trim());
      setGroupId('');
      onClose();
    }
  };

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get('window').height * 0.85}
      scrollable
      useScrollView
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>Create or Join Group</Text>

        <View style={[styles.tabBar, { backgroundColor: colors.secondary }]}>
          <PressableScale
            onPress={() => setTabIndex(0)}
            style={[
              styles.tab,
              tabIndex === 0 && [styles.tabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tabIndex === 0 ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              Create Group
            </Text>
          </PressableScale>
          <PressableScale
            onPress={() => setTabIndex(1)}
            style={[
              styles.tab,
              tabIndex === 1 && [styles.tabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tabIndex === 1 ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              Join Group
            </Text>
          </PressableScale>
        </View>

        {tabIndex === 0 ? (
          <View>
            <Input
              labelText='GROUP NAME'
              placeholder='Enter a name for your group'
              value={newGroupName}
              onChangeText={setNewGroupName}
              variant='outline'
              size='lg'
              containerStyle={styles.inputSpacing}
            />
            <PressableScale
              onPress={handleCreate}
              disabled={!newGroupName.trim()}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                Create
              </Text>
            </PressableScale>
          </View>
        ) : (
          <View>
            <Input
              labelText='GROUP ID'
              placeholder='Enter the group ID to join'
              value={groupId}
              onChangeText={setGroupId}
              variant='outline'
              size='lg'
              containerStyle={styles.inputSpacing}
            />
            <PressableScale
              onPress={handleJoin}
              disabled={!groupId.trim()}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: groupId.trim() ? colors.primary : colors.secondary,
                  opacity: groupId.trim() ? 1 : 0.6,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: groupId.trim() ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                Join
              </Text>
            </PressableScale>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <PressableScale
              onPress={() => {
                onClose();
                onScanQRCode();
              }}
              style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
            >
              <Ionicons name='qr-code-outline' size={20} color={colors.foreground} />
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                Scan QR Code
              </Text>
            </PressableScale>
          </View>
        )}

        <PressableScale onPress={onClose} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </PressableScale>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 28,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabActive: {},
  tabText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  inputSpacing: {
    marginBottom: 12,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  primaryButtonText: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
