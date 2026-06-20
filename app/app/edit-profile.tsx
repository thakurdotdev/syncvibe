import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { UserIcon, AtSignIcon, FileTextIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function EditProfileScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');

  const handleSave = async () => {
    try {
      // TODO: Save profile changes to backend
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );

  const FormField = ({
    label,
    value,
    onChangeText,
    placeholder,
    icon: Icon,
    multiline = false,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    icon: React.ComponentType<any>;
    multiline?: boolean;
  }) => (
    <View style={[styles.fieldContainer, { backgroundColor: colors.card }]}>
      <View style={styles.fieldHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Icon size={18} color={colors.primary} />
        </View>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      </View>
      <View style={styles.inputWrapper}>
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          variant='filled'
          multiline={multiline}
          inputStyle={[
            styles.input,
            multiline && styles.multilineInput,
            {
              color: colors.foreground,
              backgroundColor: colors.secondary,
            },
          ]}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information Section */}
        <View style={styles.section}>
          <SectionHeader title='PERSONAL INFORMATION' />
          <View style={styles.fieldsContainer}>
            <FormField
              label='Full Name'
              value={name}
              onChangeText={setName}
              placeholder='Enter your full name'
              icon={UserIcon}
            />
            <FormField
              label='Username'
              value={username}
              onChangeText={setUsername}
              placeholder='Choose a unique username'
              icon={AtSignIcon}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <SectionHeader title='ABOUT' />
          <View style={styles.fieldsContainer}>
            <FormField
              label='Bio'
              value={bio}
              onChangeText={setBio}
              placeholder='Tell others about yourself, your interests, and what you love about music...'
              icon={FileTextIcon}
              multiline
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleSave}
            variant='default'
            size='lg'
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
          >
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  fieldsContainer: {
    gap: 16,
  },
  fieldContainer: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 0,
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 200,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  buttonContainer: {
    marginTop: 20,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
});
