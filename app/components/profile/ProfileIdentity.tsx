import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type User = {
  name?: string;
  username?: string;
  email?: string;
  profilepic?: string;
  verified?: boolean;
};

/**
 * Who you are, in one compact horizontal card: avatar (tap to change) on the left, name,
 * handle and email beside it, and a small "Edit profile" action under them. Keeps the
 * settings below it within reach instead of pushing them off the first screen.
 */
export const ProfileIdentity = memo(function ProfileIdentity({
  user,
  onChangePhoto,
  onEdit,
}: {
  user: User;
  onChangePhoto: () => void;
  onEdit: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <PressableScale
        onPress={onChangePhoto}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel='Change profile photo'
        style={styles.avatarWrap}
      >
        <Image
          source={{ uri: getOptimizedImageUrl(user.profilepic) }}
          style={[styles.avatar, { backgroundColor: colors.muted }]}
          fadeDuration={0}
        />
        <View
          style={[styles.camera, { backgroundColor: colors.foreground, borderColor: colors.card }]}
        >
          <Feather name='camera' size={11} color={colors.background} />
        </View>
      </PressableScale>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {user.name}
          </Text>
          {user.verified && (
            <MaterialCommunityIcons name='check-decagram' size={17} color={colors.primary} />
          )}
        </View>
        {user.username ? (
          <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{user.username}
          </Text>
        ) : null}
        {user.email ? (
          <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}

        <PressableScale
          onPress={onEdit}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel='Edit profile'
          style={[styles.edit, { backgroundColor: colors.raised }]}
        >
          <Feather name='edit-2' size={12} color={colors.foreground} />
          <Text style={[styles.editText, { color: colors.foreground }]}>Edit profile</Text>
        </PressableScale>
      </View>
    </View>
  );
});

const AVATAR = 84;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 22,
    marginTop: 4,
  },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  name: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.4, flexShrink: 1 },
  handle: { fontSize: 13.5, fontWeight: '600', marginTop: 1 },
  email: { fontSize: 12.5, marginTop: 1 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 10,
  },
  editText: { fontSize: 12.5, fontWeight: '700' },
});
