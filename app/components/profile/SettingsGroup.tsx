import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** A titled run of rows directly on the page: the spacing groups them, no surface needed. */
export const SettingsGroup = memo(function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View>
      {title ? (
        <Text style={[styles.title, { color: colors.mutedForeground }]} accessibilityRole='header'>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
});

/** One settings row: icon, label (+ optional detail), and a chevron or custom trailing element. */
export const SettingsRow = memo(function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  trailing,
  destructive = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  detail?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const tint = destructive ? colors.destructive : colors.foreground;

  const content = (
    <>
      <Feather name={icon} size={20} color={destructive ? tint : colors.mutedForeground} />
      <View style={styles.text}>
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress && !destructive ? (
          <Ionicons name='chevron-forward' size={18} color={colors.mutedForeground} />
        ) : null)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    minHeight: 52,
    paddingVertical: 8,
  },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 15.5, fontWeight: '500' },
  detail: { fontSize: 12.5, marginTop: 1 },
});
