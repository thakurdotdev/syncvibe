import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

interface ChatSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}

const ChatSearchBar: React.FC<ChatSearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  inputRef,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { backgroundColor: colors.muted }]}>
        <Ionicons name='search' size={18} color={colors.mutedForeground} style={styles.icon} />
        <TextInput
          ref={inputRef}
          placeholder='Search for users...'
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, { color: colors.foreground }]}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType='search'
          autoCapitalize='none'
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Ionicons name='close-circle' size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: 42,
  },
  clearButton: {
    padding: 4,
  },
});

export default React.memo(ChatSearchBar);
