import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE, PRESS_IN, SPRING_PRESS } from '@/lib/motion';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from './PressableScale';

export const HEADER_HEIGHT = 56;

type IconName = keyof typeof Ionicons.glyphMap;

/** 38pt round icon button used in every header, so actions look and feel the same app-wide. */
export const HeaderIconButton = memo(function HeaderIconButton({
  icon,
  onPress,
  label,
  tone = 'default',
  children,
}: {
  icon?: IconName;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'primary' | 'overlay';
  children?: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const bg =
    tone === 'primary'
      ? colors.primary
      : tone === 'overlay'
        ? theme === 'dark'
          ? 'rgba(0,0,0,0.35)'
          : 'rgba(255,255,255,0.7)'
        : colors.raised;
  const fg = tone === 'primary' ? colors.primaryForeground : colors.foreground;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={8}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.iconButton, { backgroundColor: bg }]}
    >
      {children ?? (icon ? <Ionicons name={icon} size={19} color={fg} /> : null)}
    </PressableScale>
  );
});

const openSearch = () => router.push('/search');
const openProfile = () => router.navigate('/(tabs)/profile');

/**
 * Home's search: bigger than other header buttons and in the accent colour, since finding
 * music is the main thing to do from there. The lens tips and grows under your finger.
 */
const ProminentSearchButton = memo(function ProminentSearchButton() {
  const { colors } = useTheme();
  const pressed = useSharedValue(0);

  const lensStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressed.get() * 0.14 }, { rotate: `${pressed.get() * -14}deg` }],
  }));

  return (
    <PressableScale
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        openSearch();
      }}
      onPressIn={() => pressed.set(withTiming(1, PRESS_IN))}
      onPressOut={() => pressed.set(withSpring(0, SPRING_PRESS))}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel='Search music, your history, playlists and people'
      style={[styles.searchProminent, { backgroundColor: `${colors.primary}26` }]}
    >
      <Animated.View style={lensStyle}>
        <Ionicons name='search' size={24} color={colors.primary} />
      </Animated.View>
    </PressableScale>
  );
});

/**
 * Header for the tab roots. Same height, padding, type and action buttons everywhere:
 * a title on the left; page actions, search and your avatar (the way into Profile) on the right.
 * Home uses the greeting variant: avatar first, then a compact two-line greeting.
 * Place it inside a view that already applies the top safe-area inset.
 */
export const TabHeader = memo(function TabHeader({
  title,
  kicker,
  avatar = 'trailing',
  accessory,
  actions,
  showSearch = true,
  prominentSearch = false,
}: {
  title?: string;
  /** Small line above the title (e.g. "Good afternoon"); switches to the compact title size. */
  kicker?: string;
  /** Where your avatar (the way into Profile) sits; Home puts it before the greeting. */
  avatar?: 'leading' | 'trailing' | 'none';
  /** Small element after the title (e.g. connection badge). */
  accessory?: ReactNode;
  actions?: ReactNode;
  showSearch?: boolean;
  prominentSearch?: boolean;
}) {
  const { colors } = useTheme();
  const { user } = useUser();

  const avatarButton = user?.profilepic ? (
    <PressableScale
      onPress={openProfile}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel='Your profile'
      style={[
        avatar === 'leading' ? styles.avatarRing : styles.avatarRingSmall,
        { borderColor: colors.border },
      ]}
    >
      <Image source={{ uri: getProfileCloudinaryUrl(user.profilepic) }} style={styles.avatar} />
    </PressableScale>
  ) : null;

  return (
    <View style={[styles.tabHeader, kicker ? styles.tabHeaderTall : null]}>
      <View style={styles.tabHeaderLeft}>
        {avatar === 'leading' && avatarButton}
        <View style={styles.titleBlock}>
          {kicker ? (
            <Text style={[styles.kicker, { color: colors.mutedForeground }]} numberOfLines={1}>
              {kicker}
            </Text>
          ) : null}
          <Text
            style={[kicker ? styles.compactTitle : styles.tabTitle, { color: colors.foreground }]}
            numberOfLines={1}
            accessibilityRole='header'
          >
            {title}
          </Text>
        </View>
        {accessory}
      </View>
      <View style={styles.actions}>
        {actions}
        {showSearch &&
          (prominentSearch ? (
            <ProminentSearchButton />
          ) : (
            <HeaderIconButton icon='search' label='Search music' onPress={openSearch} />
          ))}
        {avatar === 'trailing' && avatarButton}
      </View>
    </View>
  );
});

/**
 * Header for pushed pages (album, artist, playlist, history…). Back button on the left, an
 * optional title in the middle (pass an animated style to reveal it on scroll), actions on
 * the right. Applies the top safe-area inset itself.
 */
export const StackHeader = memo(function StackHeader({
  title,
  titleStyle,
  right,
  overlay = false,
  onBack,
}: {
  title?: string;
  titleStyle?: StyleProp<AnimatedStyle<TextStyle>>;
  right?: ReactNode;
  /** Draw buttons with a translucent fill for pages with artwork behind the header. */
  overlay?: boolean;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const goBack =
    onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home')));

  return (
    <View style={[styles.stackHeader, { paddingTop: Math.max(insets.top, 10) }]}>
      <HeaderIconButton
        icon='chevron-back'
        label='Go back'
        tone={overlay ? 'overlay' : 'default'}
        onPress={goBack}
      />
      <Animated.Text
        style={[styles.stackTitle, { color: colors.foreground }, titleStyle]}
        numberOfLines={1}
        accessibilityRole='header'
      >
        {title}
      </Animated.Text>
      <View style={styles.stackRight}>{right ?? <View style={styles.iconButtonSpacer} />}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: { width: 38, height: 38 },
  searchProminent: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabHeader: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tabHeaderTall: { height: HEADER_HEIGHT + 8 },
  tabHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  titleBlock: { flexShrink: 1 },
  tabTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.7 },
  kicker: { fontSize: 13, fontWeight: '500', marginBottom: 1 },
  compactTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, padding: 2 },
  avatarRingSmall: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, padding: 2 },
  avatar: { width: '100%', height: '100%', borderRadius: 18 },

  stackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  stackTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  stackRight: { minWidth: 38, alignItems: 'flex-end' },
});
