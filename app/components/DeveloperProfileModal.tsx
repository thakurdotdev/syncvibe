import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, ENTER, EXIT, POP_FROM_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { CURRENT_APP_VERSION } from '@/stores/appUpdateStore';
import { fonts } from '@/theme/typography';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import SwipeableModal from './SwipeableModal';

const AVATAR =
  'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1745152151/lmdhpag0p6ubockyjs1q.jpg';

type Link = {
  name: string;
  handle: string;
  url: string;
  icon: keyof typeof Feather.glyphMap | 'x';
};

const LINKS: Link[] = [
  {
    name: 'GitHub',
    handle: '@thakurdotdev',
    url: 'https://github.com/thakurdotdev',
    icon: 'github',
  },
  {
    name: 'LinkedIn',
    handle: 'in/thakurdotdev',
    url: 'https://linkedin.com/in/thakurdotdev',
    icon: 'linkedin',
  },
  { name: 'X', handle: '@thakurdotdev', url: 'https://x.com/thakurdotdev', icon: 'x' },
  {
    name: 'Instagram',
    handle: '@thakurdotdev',
    url: 'https://instagram.com/thakurdotdev',
    icon: 'instagram',
  },
];

// The easter egg pops from just under full size, never from nothing.
const EGG_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 6 }, { scale: POP_FROM_SCALE }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(ENTER.duration);
const EGG_OUT = FadeOut.duration(EXIT.duration);

/** X's mark; Feather only has the old bird. */
function XMark({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox='0 0 24 24' fill='none'>
      <Path d='M4 4l16 16M20 4 4 20' stroke={color} strokeWidth={1.9} strokeLinecap='round' />
    </Svg>
  );
}

interface DeveloperProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
}

/** Profile → Meet the developer: who builds SyncVibe and where to find him. */
const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ isVisible, onClose }) => {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showEgg, setShowEgg] = useState(false);
  const eggTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (eggTimer.current) clearTimeout(eggTimer.current);
    },
    []
  );

  const revealEgg = () => {
    setShowEgg(true);
    if (eggTimer.current) clearTimeout(eggTimer.current);
    eggTimer.current = setTimeout(() => setShowEgg(false), 2000);
  };

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  // On a dark sheet the list sits one step up; on a light one it's a white card on white.
  const listBg = theme === 'dark' ? colors.raised : colors.card;
  const tileBg = theme === 'dark' ? colors.card : colors.raised;

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.who}>
          {showEgg && (
            <Animated.View
              entering={EGG_IN}
              exiting={EGG_OUT}
              style={[styles.egg, { backgroundColor: colors.foreground }]}
            >
              <Text style={[styles.eggText, { color: colors.background }]}>
                🚀 Keep building amazing things!
              </Text>
            </Animated.View>
          )}
          <PressableScale
            onLongPress={revealEgg}
            delayLongPress={600}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='image'
            accessibilityLabel='Pankaj Thakur'
            style={[styles.avatarRing, { borderColor: colors.hairline }]}
          >
            <Image
              source={{ uri: AVATAR }}
              style={[styles.avatar, { backgroundColor: colors.raised }]}
              fadeDuration={0}
            />
          </PressableScale>
          <View style={styles.whoText}>
            <Text style={[styles.name, { color: colors.foreground }]} accessibilityRole='header'>
              Pankaj Thakur
            </Text>
            <Text style={[styles.role, { color: colors.mutedForeground }]}>
              Software engineer · builds SyncVibe
            </Text>
          </View>
        </View>

        <Text style={[styles.bio, { color: colors.foreground }]}>
          I build SyncVibe so friends can press play together and hear the same moment, wherever
          they are. I care about apps that feel fast, simple and personal.
        </Text>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>Find me on</Text>
        <View style={[styles.links, { backgroundColor: listBg, borderColor: colors.hairline }]}>
          {LINKS.map((link, i) => (
            <PressableScale
              key={link.name}
              onPress={() => open(link.url)}
              scaleTo={ROW_PRESS_SCALE}
              accessibilityRole='link'
              accessibilityLabel={`${link.name}, ${link.handle}`}
              style={[
                styles.link,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              ]}
            >
              <View style={[styles.tile, { backgroundColor: tileBg }]}>
                {link.icon === 'x' ? (
                  <XMark color={colors.foreground} />
                ) : (
                  <Feather name={link.icon} size={18} color={colors.foreground} />
                )}
              </View>
              <View style={styles.linkText}>
                <Text style={[styles.linkName, { color: colors.foreground }]}>{link.name}</Text>
                <Text style={[styles.handle, { color: colors.mutedForeground }]}>
                  {link.handle}
                </Text>
              </View>
              <Feather name='arrow-up-right' size={18} color={colors.mutedForeground} />
            </PressableScale>
          ))}
        </View>

        <PressableScale
          onPress={() => open('https://thakur.dev')}
          accessibilityRole='link'
          accessibilityLabel='Visit thakur.dev'
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Feather name='globe' size={18} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            Visit thakur.dev
          </Text>
        </PressableScale>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          SyncVibe {CURRENT_APP_VERSION}
        </Text>
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 4 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { borderRadius: 40, borderWidth: 1.5, padding: 3 },
  avatar: { width: 66, height: 66, borderRadius: 33 },
  whoText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displayHeavy, fontSize: 25, letterSpacing: -0.6 },
  role: { fontSize: 13.5, marginTop: 3 },
  egg: {
    position: 'absolute',
    left: 0,
    top: -44,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    zIndex: 2,
  },
  eggText: { fontSize: 12, fontWeight: '700' },
  bio: { fontSize: 15, lineHeight: 22, opacity: 0.86, marginTop: 16, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 2 },
  links: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkText: { flex: 1, minWidth: 0 },
  linkName: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 12.5, marginTop: 1 },
  cta: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { fontSize: 15.5, fontWeight: '700' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 14 },
});

export default DeveloperProfileModal;
