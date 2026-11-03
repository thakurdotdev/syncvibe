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
 * Who you are, centred: avatar (tap to change), name, handle and email, and one clear
 * "Edit profile" button instead of an icon in the header.
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
      <PressableScale
        onPress={onChangePhoto}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel='Change profile photo'
        style={[styles.ring, { borderColor: colors.primary }]}
      >
        <Image
          source={{ uri: getOptimizedImageUrl(user.profilepic) }}
          style={[styles.avatar, { backgroundColor: colors.muted }]}
          fadeDuration={0}
        />
        <View
          style={[
            styles.camera,
            { backgroundColor: colors.foreground, borderColor: colors.background },
          ]}
        >
          <Feather name='camera' size={13} color={colors.background} />
        </View>
      </PressableScale>

      <View style={styles.nameRow}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {user.name}
        </Text>
        {user.verified && (
          <MaterialCommunityIcons name='check-decagram' size={20} color={colors.primary} />
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
        accessibilityRole='button'
        style={[styles.edit, { backgroundColor: colors.raised }]}
      >
        <Feather name='edit-2' size={14} color={colors.foreground} />
        <Text style={[styles.editText, { color: colors.foreground }]}>Edit profile</Text>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 24, paddingHorizontal: 24 },
  ring: { width: 108, height: 108, borderRadius: 54, borderWidth: 2.5, padding: 4 },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, maxWidth: '100%' },
  name: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6, flexShrink: 1 },
  handle: { fontSize: 14.5, fontWeight: '500', marginTop: 2 },
  email: { fontSize: 13.5, marginTop: 2 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginTop: 16,
  },
  editText: { fontSize: 14, fontWeight: '700' },
});
