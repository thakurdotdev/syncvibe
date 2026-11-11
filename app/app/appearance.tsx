import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { SettingsGroup, SettingsRow } from '@/components/profile/SettingsGroup';
import { GLASS_SUPPORTED } from '@/components/shell/GlassSurface';
import { StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { PRESS_SCALE } from '@/lib/motion';
import { useDeckStore } from '@/stores/deckStore';
import { colorPalettes, THEME_CHOICES, type ThemeChoice, type ThemeColors } from '@/theme/color';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

type Scheme = 'system' | 'light' | 'dark';

const SCHEMES: { value: Scheme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const THEME_INFO: Record<ThemeChoice, { name: string; detail: string }> = {
  mono: { name: 'Mono', detail: 'Black and white; artwork brings the colour' },
  ember: { name: 'Ember', detail: 'Warm orange on neutral greys' },
  aubergine: { name: 'Aubergine', detail: 'Plum darks and magenta, like the web' },
};

/** A tiny phone drawn in one scheme's colours: a header, a few rows, a bar. */
function MiniScreen({ c, half }: { c: ThemeColors; half?: 'left' | 'right' }) {
  return (
    <View
      style={[
        styles.mini,
        { backgroundColor: c.background },
        half === 'left' && styles.miniLeft,
        half === 'right' && styles.miniRight,
      ]}
    >
      <View style={styles.miniHead}>
        <View style={[styles.miniDot, { backgroundColor: c.primary }]} />
        <View style={[styles.miniLine, { backgroundColor: c.mutedForeground, width: 22 }]} />
      </View>
      <View style={[styles.miniBlock, { backgroundColor: c.raised }]} />
      <View style={[styles.miniLine, { backgroundColor: c.raised, width: 30 }]} />
      <View style={[styles.miniLine, { backgroundColor: c.raised, width: 22 }]} />
      <View style={[styles.miniBar, { backgroundColor: c.card, borderColor: c.border }]} />
    </View>
  );
}

const SchemeCard = memo(function SchemeCard({
  scheme,
  label,
  selected,
  onPress,
  palette,
  colors,
}: {
  scheme: Scheme;
  label: string;
  selected: boolean;
  onPress: () => void;
  palette: ThemeChoice;
  colors: ThemeColors;
}) {
  const p = colorPalettes[palette];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={PRESS_SCALE}
      accessibilityRole='radio'
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} colour scheme`}
      style={[
        styles.schemeCard,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.foreground : colors.hairline,
        },
      ]}
    >
      <View style={[styles.phone, { borderColor: colors.border }]}>
        {scheme === 'system' ? (
          <View style={styles.split}>
            <MiniScreen c={p.light} half='left' />
            <MiniScreen c={p.dark} half='right' />
          </View>
        ) : (
          <MiniScreen c={scheme === 'light' ? p.light : p.dark} />
        )}
      </View>
      <Text
        style={[
          styles.cardLabel,
          {
            color: selected ? colors.foreground : colors.mutedForeground,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
});

/** One theme's colour as a lit sphere: its surface fading into its accent. */
function Swatch({ c }: { c: ThemeColors }) {
  return (
    <View style={[styles.swatch, { borderColor: c.border }]}>
      <LinearGradient
        colors={[c.card, c.primary]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.55, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const ThemeCard = memo(function ThemeCard({
  choice,
  selected,
  onPress,
  colors,
}: {
  choice: ThemeChoice;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const p = colorPalettes[choice];
  const info = THEME_INFO[choice];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={PRESS_SCALE}
      accessibilityRole='radio'
      accessibilityState={{ selected }}
      accessibilityLabel={`${info.name} theme. ${info.detail}`}
      style={[
        styles.themeCard,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.foreground : colors.hairline,
        },
      ]}
    >
      <View style={styles.swatches}>
        <Swatch c={p.light} />
        <Swatch c={p.dark} />
      </View>
      <View style={styles.themeText}>
        <Text style={[styles.themeName, { color: colors.foreground }]}>{info.name}</Text>
        <Text style={[styles.themeDetail, { color: colors.mutedForeground }]} numberOfLines={2}>
          {info.detail}
        </Text>
      </View>
    </PressableScale>
  );
});

/** Settings → Appearance: colour scheme, theme, and how the bottom bar looks. */
export default function AppearanceScreen() {
  const { colors, themePreference, setTheme, palette, setPalette } = useTheme();
  const glass = useDeckStore((s) => s.glass);
  const setGlass = useDeckStore((s) => s.setGlass);
  const songPopup = useDeckStore((s) => s.songPopup);
  const setSongPopup = useDeckStore((s) => s.setSongPopup);
  const showCard = useDeckStore((s) => s.showCard);
  const setShowCard = useDeckStore((s) => s.setShowCard);

  const switchColors = { false: colors.border, true: colors.primary };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StackHeader title='Appearance' />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
      >
        <SettingsGroup title='Colour scheme'>
          <View style={styles.row} accessibilityRole='radiogroup'>
            {SCHEMES.map((s) => (
              <SchemeCard
                key={s.value}
                scheme={s.value}
                label={s.label}
                selected={themePreference === s.value}
                onPress={() => setTheme(s.value)}
                palette={palette}
                colors={colors}
              />
            ))}
          </View>
        </SettingsGroup>

        <SettingsGroup title='Theme'>
          <View style={styles.grid} accessibilityRole='radiogroup'>
            {THEME_CHOICES.map((choice) => (
              <ThemeCard
                key={choice}
                choice={choice}
                selected={palette === choice}
                onPress={() => setPalette(choice)}
                colors={colors}
              />
            ))}
          </View>
        </SettingsGroup>

        <SettingsGroup title='Bottom bar'>
          {GLASS_SUPPORTED && (
            <SettingsRow
              icon='layers'
              label='Glass'
              detail='Blur what scrolls behind the bar'
              onPress={() => setGlass(!glass)}
              trailing={
                <Switch
                  value={glass}
                  onValueChange={setGlass}
                  trackColor={switchColors}
                  thumbColor={colors.card}
                  accessibilityLabel='Glass'
                />
              }
            />
          )}
          <SettingsRow
            icon='zap'
            label='Song pop-up'
            detail='Show the new song for a moment when it changes'
            onPress={() => setSongPopup(!songPopup)}
            trailing={
              <Switch
                value={songPopup}
                onValueChange={setSongPopup}
                trackColor={switchColors}
                thumbColor={colors.card}
                accessibilityLabel='Song pop-up'
              />
            }
          />
          <SettingsRow
            icon='music'
            label='Player card'
            detail='Keep the song and room above the tabs'
            onPress={() => setShowCard(!showCard)}
            trailing={
              <Switch
                value={showCard}
                onValueChange={setShowCard}
                trackColor={switchColors}
                thumbColor={colors.card}
                accessibilityLabel='Player card'
              />
            }
          />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, gap: 28 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 6 },

  schemeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 2,
  },
  phone: { width: 58, height: 96, borderRadius: 14, borderWidth: 3, overflow: 'hidden' },
  split: { flex: 1, flexDirection: 'row' },
  mini: { flex: 1, padding: 6, gap: 5, overflow: 'hidden' },
  miniLeft: { paddingRight: 0 },
  miniRight: { paddingLeft: 3 },
  miniHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniLine: { height: 4, borderRadius: 2 },
  miniBlock: { height: 22, borderRadius: 5 },
  miniBar: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    height: 8,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLabel: { fontSize: 14 },

  themeCard: {
    width: '48.5%',
    flexGrow: 1,
    padding: 14,
    gap: 12,
    borderRadius: 20,
    borderWidth: 2,
  },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeText: { gap: 2 },
  themeName: { fontSize: 16, fontWeight: '700' },
  themeDetail: { fontSize: 12.5, lineHeight: 17 },
});
