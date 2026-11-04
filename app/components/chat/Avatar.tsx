import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function hasValidImage(profilepic: string | undefined): boolean {
  return !!profilepic && profilepic.trim().length > 0;
}

interface AvatarProps {
  name?: string;
  profilepic?: string;
  size?: 'sm' | 'md';
  isOnline?: boolean;
}

const SIZES = { sm: 38, md: 52 } as const;
const INDICATOR = { sm: 10, md: 13 } as const;

const Avatar: React.FC<AvatarProps> = ({ name, profilepic, size = 'md', isOnline }) => {
  const { colors } = useTheme();
  const dim = SIZES[size];
  const indicatorDim = INDICATOR[size];

  const initials = useMemo(() => getInitials(name), [name]);
  const showImage = hasValidImage(profilepic);

  return (
    <View style={[styles.container, { width: dim, height: dim }]}>
      {showImage ? (
        <Image
          source={{ uri: getProfileCloudinaryUrl(profilepic) }}
          style={[
            styles.image,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: colors.muted,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: colors.raised,
            },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: dim * 0.38, color: colors.foreground }]}>
            {initials}
          </Text>
        </View>
      )}

      {isOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: indicatorDim,
              height: indicatorDim,
              borderRadius: indicatorDim / 2,
              backgroundColor: colors.foreground,
              borderColor: colors.background,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});

export default React.memo(Avatar);
