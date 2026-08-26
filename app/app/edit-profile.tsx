import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/context/ToastContext';
import { router } from 'expo-router';
import { UserIcon, AtSignIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Card from '@/components/ui/card';

export default function EditProfileScreen() {
  const { user, updateUser } = useUser();
  const { colors } = useTheme();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      await updateUser({ name, username, bio });
      toast('Profile updated successfully!', { type: 'success' });
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast('Failed to update profile details', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
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
        <View style={styles.section}>
          <SectionHeader title='PERSONAL INFORMATION' />
          <Card style={styles.cardContainer}>
            <Input
              labelText='Full Name'
              value={name}
              onChangeText={setName}
              placeholder='Enter your full name'
              leftIcon={<UserIcon size={18} color={colors.primary} />}
              variant='filled'
              editable={!isSaving}
            />
            <Input
              labelText='Username'
              value={username}
              onChangeText={setUsername}
              placeholder='Choose a unique username'
              leftIcon={<AtSignIcon size={18} color={colors.primary} />}
              variant='filled'
              editable={!isSaving}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title='ABOUT' />
          <Card style={styles.cardContainer}>
            <Input
              labelText='Bio'
              value={bio}
              onChangeText={setBio}
              placeholder='Tell others about yourself, your interests, and what you love about music...'
              variant='filled'
              multiline
              editable={!isSaving}
              inputStyle={styles.multilineInput}
            />
          </Card>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            onPress={handleSave}
            variant='default'
            size='lg'
            isLoading={isSaving}
            disabled={isSaving}
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
  cardContainer: {
    padding: 20,
    gap: 20,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
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
