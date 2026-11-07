import PressableScale from '@/components/ui/PressableScale';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

type Mode = 'create' | 'join';

const MODES: SegmentOption<Mode>[] = [
  { value: 'create', label: 'Create' },
  { value: 'join', label: 'Join' },
];

/**
 * Only what starting or joining a room takes, so it stays a small sheet sitting on the keyboard.
 * Tapping outside or dragging it down closes it.
 */
export const CreateOrJoinModal: React.FC<CreateOrJoinModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  onJoinGroup,
  onScanQRCode,
  initialTab = 'create',
}) => {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>(initialTab);
  // The caller unmounts this from onClose, so closing here lets the sheet slide away first.
  const [open, setOpen] = useState(isOpen);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const value = (mode === 'create' ? name : code).trim();

  const submit = () => {
    if (!value) return;
    if (mode === 'create') onCreateGroup(value);
    else onJoinGroup(value);
    setOpen(false);
  };

  return (
    <SwipeableModal isVisible={open} onClose={onClose} dragAnywhere>
      <View style={styles.content}>
        <Segmented
          options={MODES}
          value={mode}
          onChange={setMode}
          accessibilityLabel='Create or join a room'
        />

        {mode === 'create' ? (
          <Input
            key='create'
            placeholder='Room name'
            value={name}
            onChangeText={setName}
            variant='filled'
            returnKeyType='go'
            onSubmitEditing={submit}
            accessibilityLabel='Room name'
          />
        ) : (
          <Input
            key='join'
            placeholder='Room code'
            value={code}
            onChangeText={setCode}
            variant='filled'
            autoCapitalize='none'
            autoCorrect={false}
            returnKeyType='go'
            onSubmitEditing={submit}
            accessibilityLabel='Room code'
            rightIcon={
              <PressableScale
                onPress={() => {
                  setOpen(false);
                  onScanQRCode();
                }}
                hitSlop={10}
                accessibilityRole='button'
                accessibilityLabel='Scan a QR code'
              >
                <Ionicons name='qr-code-outline' size={20} color={colors.foreground} />
              </PressableScale>
            }
          />
        )}

        <PressableScale
          onPress={submit}
          disabled={!value}
          accessibilityRole='button'
          accessibilityState={{ disabled: !value }}
          style={[styles.submit, { backgroundColor: colors.primary, opacity: value ? 1 : 0.4 }]}
        >
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {mode === 'create' ? 'Create room' : 'Join room'}
          </Text>
        </PressableScale>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  submit: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: '700' },
});
