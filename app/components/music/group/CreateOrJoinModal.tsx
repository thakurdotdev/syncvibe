import React, { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/common/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';

interface CreateOrJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string) => void;
  onJoinGroup: (id: string) => void;
  onScanQRCode: () => void;
}

export const CreateOrJoinModal: React.FC<CreateOrJoinModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  onJoinGroup,
  onScanQRCode,
}) => {
  const { colors } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
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
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ padding: 24, paddingBottom: 40 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 22,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Create or Join Group
          </Text>

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.secondary,
              borderRadius: 14,
              marginBottom: 28,
              padding: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => setTabIndex(0)}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: tabIndex === 0 ? colors.primary : 'transparent',
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: tabIndex === 0 ? colors.primaryForeground : colors.mutedForeground,
                  fontWeight: '600',
                  fontSize: 15,
                }}
              >
                Create Group
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTabIndex(1)}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: tabIndex === 1 ? colors.primary : 'transparent',
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: tabIndex === 1 ? colors.primaryForeground : colors.mutedForeground,
                  fontWeight: '600',
                  fontSize: 15,
                }}
              >
                Join Group
              </Text>
            </TouchableOpacity>
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
                containerStyle={{ marginBottom: 12 }}
              />
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!newGroupName.trim()}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  marginTop: 20,
                }}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontWeight: '700',
                    textAlign: 'center',
                    fontSize: 16,
                  }}
                >
                  Create
                </Text>
              </TouchableOpacity>
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
                containerStyle={{ marginBottom: 12 }}
              />
              <TouchableOpacity
                onPress={handleJoin}
                disabled={!groupId.trim()}
                style={{
                  backgroundColor: groupId.trim() ? colors.primary : colors.secondary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  marginTop: 20,
                  opacity: groupId.trim() ? 1 : 0.6,
                }}
              >
                <Text
                  style={{
                    color: groupId.trim() ? colors.primaryForeground : colors.mutedForeground,
                    fontWeight: '700',
                    textAlign: 'center',
                    fontSize: 16,
                  }}
                >
                  Join
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginVertical: 20,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text
                  style={{
                    marginHorizontal: 16,
                    color: colors.mutedForeground,
                    fontSize: 13,
                    fontWeight: '500',
                  }}
                >
                  OR
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onScanQRCode();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 16,
                  borderRadius: 14,
                }}
              >
                <Ionicons
                  name='qr-code-outline'
                  size={20}
                  color={colors.foreground}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: '600',
                    fontSize: 16,
                  }}
                >
                  Scan QR Code
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 32,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 15,
                fontWeight: '500',
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SwipeableModal>
  );
};
