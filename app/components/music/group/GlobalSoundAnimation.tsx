import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';

const EqualizerBar = ({ delay, minH, maxH }: { delay: number; minH: number; maxH: number }) => {
  const { colors } = useTheme();
  const height = useSharedValue(minH);

  useEffect(() => {
    const timer = setTimeout(() => {
      height.value = withRepeat(
        withSequence(withTiming(maxH, { duration: 250 }), withTiming(minH, { duration: 250 })),
        -1,
        true
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, minH, maxH, height]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.eqBar, { backgroundColor: colors.primary }, animStyle]} />;
};

interface GlobalSoundAnimationProps {
  currentUserId?: number | string;
}

export const GlobalSoundAnimation: React.FC<GlobalSoundAnimationProps> = ({ currentUserId }) => {
  const { colors } = useTheme();
  const activeSoundEffect = useGroupSessionStore((s) => s.activeSoundEffect);
  const clearActiveSoundEffect = useGroupSessionStore((s) => s.clearActiveSoundEffect);

  useEffect(() => {
    if (!activeSoundEffect) return;
    const timer = setTimeout(() => {
      clearActiveSoundEffect();
    }, 3200);
    return () => clearTimeout(timer);
  }, [activeSoundEffect, clearActiveSoundEffect]);

  if (!activeSoundEffect) return null;

  const isOwn = String(activeSoundEffect.senderId) === String(currentUserId);
  const displayName = isOwn ? 'You' : activeSoundEffect.userName || 'Someone';

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18).stiffness(350)}
      exiting={FadeOutUp.duration(200)}
      style={styles.floatingContainer}
      pointerEvents='none'
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.card || '#1a1a1a',
            borderColor: colors.primary + '60',
            shadowColor: '#000',
          },
        ]}
      >
        {activeSoundEffect.profilePic ? (
          <Image
            source={{
              uri:
                getProfileCloudinaryUrl(activeSoundEffect.profilePic) ||
                'https://via.placeholder.com/26',
            }}
            style={[styles.avatar, { borderColor: colors.primary + '80' }]}
          />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '25' }]}>
            <Feather name='volume-2' size={13} color={colors.primary} />
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={[styles.senderName, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>played</Text>
          <Text style={[styles.soundTitle, { color: colors.primary }]} numberOfLines={1}>
            {activeSoundEffect.soundName}
          </Text>
        </View>

        <View style={styles.eqContainer}>
          <EqualizerBar delay={0} minH={4} maxH={14} />
          <EqualizerBar delay={80} minH={5} maxH={15} />
          <EqualizerBar delay={160} minH={3} maxH={13} />
          <EqualizerBar delay={240} minH={6} maxH={16} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1.5,
    maxWidth: '92%',
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '400',
  },
  soundTitle: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 130,
  },
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 16,
    paddingLeft: 4,
  },
  eqBar: {
    width: 2.5,
    borderRadius: 2,
  },
});

export default React.memo(GlobalSoundAnimation);
