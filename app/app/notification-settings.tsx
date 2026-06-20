import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { MessageSquareIcon, VibrateIcon, VideoIcon, VolumeXIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationSettingsScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState({
    messages: true,
    videoCalls: true,
    sound: true,
    vibration: true,
  });

  const handleSave = async () => {
    try {
      router.back();
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );

  const NotificationToggle = ({
    title,
    description,
    icon: Icon,
    value,
    onValueChange,
    isLast = false,
  }: {
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
  }) => (
    <View
      style={[
        styles.toggleContainer,
        {
          backgroundColor: colors.card,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.toggleContent}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: value ? colors.primary + '20' : colors.secondary,
            },
          ]}
        >
          <Icon size={20} color={value ? colors.primary : colors.mutedForeground} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.toggleTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.toggleDescription, { color: colors.mutedForeground }]}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.border,
          true: colors.primary + '40',
        }}
        thumbColor={value ? colors.primary : colors.background}
        ios_backgroundColor={colors.border}
        style={styles.switch}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* App Notifications Section */}
        <View style={styles.section}>
          <SectionHeader title='APP NOTIFICATIONS' />
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <NotificationToggle
              title='Message Notifications'
              description='Get notified when you receive new messages'
              icon={MessageSquareIcon}
              value={notifications.messages}
              onValueChange={(value) => setNotifications({ ...notifications, messages: value })}
            />
            <NotificationToggle
              title='Video Call Notifications'
              description='Get notified when someone wants to video call'
              icon={VideoIcon}
              value={notifications.videoCalls}
              onValueChange={(value) => setNotifications({ ...notifications, videoCalls: value })}
              isLast
            />
          </View>
        </View>

        {/* Sound & Vibration Section */}
        <View style={styles.section}>
          <SectionHeader title='SOUND & VIBRATION' />
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <NotificationToggle
              title='Sound'
              description='Play sound for notifications'
              icon={VolumeXIcon}
              value={notifications.sound}
              onValueChange={(value) => setNotifications({ ...notifications, sound: value })}
            />
            <NotificationToggle
              title='Vibration'
              description='Vibrate for notifications'
              icon={VibrateIcon}
              value={notifications.vibration}
              onValueChange={(value) => setNotifications({ ...notifications, vibration: value })}
              isLast
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
    </View>
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
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
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
