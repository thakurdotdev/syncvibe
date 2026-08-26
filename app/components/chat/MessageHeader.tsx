import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Avatar from './Avatar';

interface MessageHeaderProps {
  onBack: () => void;
  user:
    | {
        name?: string;
        profilepic?: string;
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
      <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
        <Ionicons name='chevron-back' size={22} color={colors.foreground} />
      </Pressable>

      <Avatar name={user?.name} profilepic={user?.profilepic} size='sm' isOnline={isOnline} />

      <View style={styles.textContainer}>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        {isTyping ? (
          <Text style={[styles.status, { color: colors.primary }]}>typing...</Text>
        ) : isOnline ? (
          <Text style={[styles.status, { color: colors.mutedForeground }]}>online</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 4,
  },
  textContainer: {
    marginLeft: 10,
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
