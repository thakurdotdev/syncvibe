import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/typography';
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shared layout for the security sheets: an icon badge, a title, a line of help, then content. */
export const SheetLayout = ({
  icon,
  tone = 'primary',
  title,
  description,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  tone?: 'primary' | 'destructive';
  title: string;
  description?: string;
  children: ReactNode;
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tint = tone === 'destructive' ? colors.destructive : colors.primary;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.badge, { backgroundColor: `${tint}1F` }]}>
        <Feather name={icon} size={22} color={tint} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 4 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.4 },
  description: { fontSize: 14.5, lineHeight: 20, marginTop: 6 },
  body: { marginTop: 20, gap: 12 },
});
