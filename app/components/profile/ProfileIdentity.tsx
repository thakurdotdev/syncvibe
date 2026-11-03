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
 * Who you are: avatar (tap to change) beside your name, handle and email, then one
 * full-width Edit profile action. No card around it: it is the page's header.
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
    <View style={styles.wrap}>
      <View style={styles.row}>
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
            style={[
              styles.camera,
              { backgroundColor: colors.raised, borderColor: colors.background },
            ]}
          >
            <Feather name='camera' size={12} color={colors.foreground} />
          </View>
        </PressableScale>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {user.name}
            </Text>
            {user.verified && (
              <MaterialCommunityIcons name='check-decagram' size={18} color={colors.primary} />
            )}
          </View>
          {user.username ? (
            <Text style={[styles.handle, { color: colors.foreground }]} numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
          {user.email ? (
            <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <PressableScale
        onPress={onEdit}
        scaleTo={0.98}
        accessibilityRole='button'
        accessibilityLabel='Edit profile'
        style={[styles.edit, { backgroundColor: colors.raised }]}
      >
        <Text style={[styles.editText, { color: colors.foreground }]}>Edit profile</Text>
      </PressableScale>
    </View>
  );
});

const AVATAR = 76;

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingTop: 4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  camera: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  name: { fontFamily: fonts.display, fontSize: 23, letterSpacing: -0.5, flexShrink: 1 },
  handle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  email: { fontSize: 13, marginTop: 1 },
  edit: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontSize: 14.5, fontWeight: '700' },
});
