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
 * Who you are: avatar (tap to change), name, handle and email, with a small Edit action at the
 * end of the row. It heads the page, so it needs no card, and editing is rare, so no big button.
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
          <Feather name='camera' size={11} color={colors.foreground} />
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
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{user.username}
          </Text>
        ) : null}
        {user.email ? (
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}
      </View>

      <PressableScale
        onPress={onEdit}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel='Edit profile'
        style={[styles.edit, { borderColor: colors.border }]}
      >
        <Text style={[styles.editText, { color: colors.foreground }]}>Edit</Text>
      </PressableScale>
    </View>
  );
});

const AVATAR = 68;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  name: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5, flexShrink: 1 },
  meta: { fontSize: 13, marginTop: 1 },
  edit: {
    height: 34,
    paddingHorizontal: 15,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontSize: 13.5, fontWeight: '600' },
});
