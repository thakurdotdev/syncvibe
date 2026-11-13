import { TabHeader } from '@/components/ui/AppHeader';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useTheme } from '@/context/ThemeContext';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * A tab while your profile is still on its way (signed in, nothing saved on this phone yet).
 * Shows the tab's real header, so the page doesn't flash the sign-in screen or jump when it loads.
 */
export function TabLoading({ title, showSearch }: { title: string; showSearch?: boolean }) {
  const { colors } = useTheme();
  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <TabHeader title={title} showSearch={showSearch} />
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
