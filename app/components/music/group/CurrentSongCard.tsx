import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';

interface CurrentSongCardProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onChooseSong: () => void;
}

export const CurrentSongCard: React.FC<CurrentSongCardProps> = ({
  currentSong,
  isPlaying,
  onPlayPause,
  onChooseSong,
}) => {
  const { colors } = useTheme();

  return (
    <Card variant='outline' className='m-4'>
      <CardContent>
        {currentSong ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={{
                uri: currentSong.image?.[1]?.link || 'https://via.placeholder.com/60',
              }}
              style={{ width: 64, height: 64, borderRadius: 8 }}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: '500',
                  fontSize: 16,
                }}
                numberOfLines={1}
              >
                {currentSong.name}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {currentSong.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onPlayPause}
              style={{
                backgroundColor: colors.secondary,
                height: 48,
                width: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color={colors.foreground}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onChooseSong}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <Feather name='music' size={28} color={colors.foreground} />
            <Text
              style={{
                color: colors.foreground,
                marginTop: 12,
                fontWeight: '500',
                fontSize: 16,
              }}
            >
              Choose a song to play
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 14,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Start the music for everyone in your group
            </Text>
          </TouchableOpacity>
        )}
      </CardContent>
    </Card>
  );
};
