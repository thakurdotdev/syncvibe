import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';

const AVATAR_COLORS = [
  '#E57373',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DD0E1',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#A1887F',
  '#90A4AE',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

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

  const bgColor = useMemo(() => AVATAR_COLORS[hashName(name || '') % AVATAR_COLORS.length], [name]);

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
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: dim * 0.38 }]}>{initials}</Text>
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
              backgroundColor: '#4CAF50',
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
    color: '#FFFFFF',
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
