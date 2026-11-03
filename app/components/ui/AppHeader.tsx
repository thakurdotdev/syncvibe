import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
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
 * Header for the five tab roots. Same height, padding, type and action buttons everywhere:
 * a title on the left, page actions then search on the right. Home uses the `greeting`
 * variant: your avatar plus a compact two-line greeting instead of a big title.
 * Place it inside a view that already applies the top safe-area inset.
 */
export const TabHeader = memo(function TabHeader({
  title,
  kicker,
  showAvatar = false,
  accessory,
  actions,
  showSearch = true,
}: {
  title?: string;
  /** Small line above the title (e.g. "Good afternoon"); switches to the compact title size. */
  kicker?: string;
  /** Show your avatar before the title; tapping it opens Profile. */
  showAvatar?: boolean;
  /** Small element after the title (e.g. connection badge). */
  accessory?: ReactNode;
  actions?: ReactNode;
  showSearch?: boolean;
}) {
  const { colors } = useTheme();
  const { user } = useUser();

  return (
    <View style={[styles.tabHeader, kicker ? styles.tabHeaderTall : null]}>
      <View style={styles.tabHeaderLeft}>
        {showAvatar && user?.profilepic ? (
          <PressableScale
            onPress={openProfile}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Your profile'
            style={[styles.avatarRing, { borderColor: colors.primary }]}
          >
            <Image
              source={{ uri: getProfileCloudinaryUrl(user.profilepic) }}
              style={styles.avatar}
            />
          </PressableScale>
        ) : null}
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
        {showSearch && <HeaderIconButton icon='search' label='Search music' onPress={openSearch} />}
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
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, padding: 2 },
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
