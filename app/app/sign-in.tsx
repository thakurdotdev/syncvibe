import { AuthPanel } from '@/components/auth/AuthPanel';
import { useTheme } from '@/context/ThemeContext';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Sign-in for people who have already been through onboarding, e.g. after logging out. */
export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom + 12, 20),
        },
      ]}
    >
      <AuthPanel active />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
