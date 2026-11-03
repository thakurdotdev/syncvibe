import PressableScale from '@/components/ui/PressableScale';
import Card from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Children, Fragment, memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** A titled group of rows on one surface, separated by inset hairlines. */
export const SettingsGroup = memo(function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
      ) : null}
      {/* Same surface as the app's default Card: solid, no border, no shadow. */}
      <Card variant='default' style={styles.surface}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {row}
          </Fragment>
        ))}
      </Card>
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
      <View
        style={[
          styles.icon,
          { backgroundColor: destructive ? `${colors.destructive}1A` : colors.raised },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={destructive ? colors.destructive : colors.foreground}
        />
      </View>
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
  group: { gap: 8 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  surface: { overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 56,
    paddingVertical: 10,
  },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 12.5, marginTop: 1 },
});
