import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PressableScale from '@/components/ui/PressableScale';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Avatar from './Avatar';

interface MessageHeaderProps {
  onBack: () => void;
  user:
    | {
        name?: string;
        profilepic?: string | null;
        userid?: string | number;
      }
    | undefined;
  isOnline: boolean;
  isTyping: boolean | undefined;
}

const MessageHeader: React.FC<MessageHeaderProps> = ({ onBack, user, isOnline, isTyping }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <PressableScale
        onPress={onBack}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel='Go back'
        style={styles.backButton}
      >
        <Ionicons name='chevron-back' size={24} color={colors.foreground} />
      </PressableScale>

      <Avatar
        name={user?.name}
        profilepic={user?.profilepic ?? undefined}
        size='sm'
        isOnline={isOnline}
      />

      <View style={styles.textContainer}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {user?.name}
        </Text>
        {isTyping ? (
          <Text style={[styles.status, { color: colors.foreground }]}>typing…</Text>
        ) : isOnline ? (
          <Text style={[styles.status, { color: colors.mutedForeground }]}>Online</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    marginLeft: 8,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
});

export default React.memo(MessageHeader);
