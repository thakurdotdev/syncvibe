import PressableScale from '@/components/ui/PressableScale';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SwipeableModal from '@/components/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';

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
  { value: 'create', label: 'Create', icon: 'add-circle-outline' },
  { value: 'join', label: 'Join', icon: 'enter-outline' },
];

const COPY = {
  create: { title: 'Start a room', hint: 'Name it, then invite friends to listen along.' },
  join: { title: 'Join a room', hint: 'Enter the code a friend shared, or scan their QR.' },
} as const;

/** Ideas to tap instead of typing; the first uses your own name. */
const NAME_IDEAS = ['Late night', 'Road trip', 'Study session', 'Workout'];

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
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>(initialTab);
  // The caller unmounts this from onClose, so closing here lets the sheet slide away first.
  const [open, setOpen] = useState(isOpen);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const value = (mode === 'create' ? name : code).trim();
  const copy = COPY[mode];

  const ideas = useMemo(() => {
    const first = String(user?.name || '')
      .trim()
      .split(/\s+/)[0];
    return first ? [`${first}'s room`, ...NAME_IDEAS] : NAME_IDEAS;
  }, [user?.name]);

  const submit = () => {
    if (!value) return;
    if (mode === 'create') onCreateGroup(value);
    else onJoinGroup(value);
    setOpen(false);
  };

  const scan = () => {
    setOpen(false);
    onScanQRCode();
  };

  return (
    <SwipeableModal isVisible={open} onClose={onClose} dragAnywhere>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
            {copy.title}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{copy.hint}</Text>
        </View>

        <Segmented
          options={MODES}
          value={mode}
          onChange={setMode}
          accessibilityLabel='Create or join a room'
        />

        {mode === 'create' ? (
          <View style={styles.field}>
            <Input
              key='create'
              placeholder='Room name'
              value={name}
              onChangeText={setName}
              variant='filled'
              returnKeyType='go'
              onSubmitEditing={submit}
              accessibilityLabel='Room name'
              leftIcon={<Ionicons name='musical-notes' size={18} color={colors.mutedForeground} />}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps='handled'
              contentContainerStyle={styles.ideas}
            >
              {ideas.map((idea) => {
                const picked = name === idea;
                return (
                  <PressableScale
                    key={idea}
                    onPress={() => setName(idea)}
                    scaleTo={BUTTON_PRESS_SCALE}
                    accessibilityRole='button'
                    accessibilityLabel={`Name it ${idea}`}
                    style={[
                      styles.idea,
                      {
                        backgroundColor: picked ? `${colors.primary}1A` : colors.raised,
                        borderColor: picked ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ideaText,
                        { color: picked ? colors.primary : colors.foreground },
                      ]}
                    >
                      {idea}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.field}>
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
              leftIcon={<Ionicons name='key-outline' size={18} color={colors.mutedForeground} />}
            />
            <PressableScale
              onPress={scan}
              accessibilityRole='button'
              accessibilityLabel='Scan a QR code'
              style={[styles.scanRow, { backgroundColor: colors.raised }]}
            >
              <View style={[styles.scanIcon, { backgroundColor: colors.card }]}>
                <Ionicons name='qr-code-outline' size={18} color={colors.foreground} />
              </View>
              <View style={styles.scanText}>
                <Text style={[styles.scanTitle, { color: colors.foreground }]}>Scan a QR code</Text>
                <Text style={[styles.scanBody, { color: colors.mutedForeground }]}>
                  From a friend's room screen
                </Text>
              </View>
              <Ionicons name='chevron-forward' size={18} color={colors.mutedForeground} />
            </PressableScale>
          </View>
        )}

        <PressableScale
          onPress={submit}
          disabled={!value}
          accessibilityRole='button'
          accessibilityState={{ disabled: !value }}
          style={[styles.submit, { backgroundColor: colors.primary, opacity: value ? 1 : 0.4 }]}
        >
          <Ionicons
            name={mode === 'create' ? 'radio' : 'enter-outline'}
            size={18}
            color={colors.primaryForeground}
          />
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {mode === 'create' ? 'Create room' : 'Join room'}
          </Text>
        </PressableScale>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  heading: { gap: 4, paddingHorizontal: 2 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  hint: { fontSize: 14, lineHeight: 19 },
  field: { gap: 10 },
  ideas: { gap: 8, paddingRight: 4 },
  idea: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaText: { fontSize: 13, fontWeight: '600' },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
  },
  scanIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: { flex: 1, minWidth: 0 },
  scanTitle: { fontSize: 14, fontWeight: '600' },
  scanBody: { fontSize: 12, marginTop: 1 },
  submit: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 15, fontWeight: '700' },
});
