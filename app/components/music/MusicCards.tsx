import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { usePlayerControls, useSongPlaybackState } from '@/stores/playerStore';
import { Album, Artist, Playlist } from '@/types/music';
import { Song } from '@/types/song';
import { convertToHttps, ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { useProgress } from '@rntp/player';
import { router } from 'expo-router';
import { memo, default as React, useCallback, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import PressableScale from '@/components/ui/PressableScale';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import NewPlayerDrawer from './NewPlayerDrawer';
import { PlayingBars } from './PlayingBars';
import { useSongPress } from './useSongPress';

interface SongCardProps {
  song: Song;
  onPress?: () => void | Promise<void>;
}

interface AlbumCardProps {
  album: Album;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
}

interface PlaylistCardProps {
  playlist: Playlist;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
}

interface ArtistCardProps {
  artist: Artist;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

interface CustomSliderProps {
  value: number;
  maxValue: number;
  onSeek: (value: number) => void;
  trackColor?: string;
  inactiveTrackColor?: string;
  thumbSize?: number;
  trackHeight?: number;
}

export const CustomSlider = ({
  value,
  maxValue,
  onSeek,
  trackColor = '#fff',
  inactiveTrackColor = 'rgba(255, 255, 255, 0.2)',
  thumbSize = 14,
  trackHeight = 4,
}: CustomSliderProps) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);

  const progressPercent = maxValue > 0 ? value / maxValue : 0;

  const animatedStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return {
        width: `${clamp(dragX.value * 100, 0, 100)}%`,
      };
    }
    return {
      width: `${progressPercent * 100}%`,
    };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const leftPercent = isDragging.value ? dragX.value : progressPercent;
    return {
      left: `${clamp(leftPercent * 100, 0, 100)}%`,
      transform: [
        { translateX: -thumbSize / 2 },
        { scale: isDragging.value ? withSpring(1.2) : withSpring(1) },
      ],
    };
  });

  const gesture = Gesture.Pan()
    .onStart((event) => {
      isDragging.value = true;
      dragX.value = event.x / (sliderWidth || 1);
    })
    .onChange((event) => {
      dragX.value = event.x / (sliderWidth || 1);
    })
    .onEnd(() => {
      const finalValue = clamp(dragX.value * maxValue, 0, maxValue);
      scheduleOnRN(onSeek, finalValue);
      isDragging.value = false;
    });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const finalValue = clamp((event.x / (sliderWidth || 1)) * maxValue, 0, maxValue);
    scheduleOnRN(onSeek, finalValue);
  });

  const composedGesture = Gesture.Exclusive(gesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={{
          width: '100%',
          height: 40,
          justifyContent: 'center',
        }}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      >
        <View
          style={{
            height: trackHeight,
            backgroundColor: inactiveTrackColor,
            borderRadius: trackHeight / 2,
            width: '100%',
            position: 'relative',
          }}
        >
          <Animated.View
            style={[
              {
                height: '100%',
                backgroundColor: trackColor,
                borderRadius: trackHeight / 2,
              },
              animatedStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: trackColor,
                top: (trackHeight - thumbSize) / 2,
              },
              thumbStyle,
            ]}
          />
        </View>
      </View>
    </GestureDetector>
  );
};

interface CardContainerProps {
  children: React.ReactNode;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
  width?: number | `${number}%` | 'auto';
  style?: StyleProp<ViewStyle>;
}

export const CardContainer = memo(
  ({ children, onPress, onLongPress, width, style }: CardContainerProps) => {
    // Press feedback runs on the UI thread (no re-render per touch), like every card app-wide.
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[{ width: width ?? '100%' }, style]}
      >
        {children}
      </PressableScale>
    );
  }
);

export const SongCard = memo(
  ({
    song,
    disableOnLongPress = false,
    onPress: onPressCallback,
  }: SongCardProps & { disableOnLongPress?: boolean }) => {
    const { playSong, handlePlayPause } = usePlayerControls();
    const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id);
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song]);
    const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

    const handlePress = useCallback(async () => {
      if (onPressCallback) {
        await onPressCallback();
      }

      if (isCurrentSong) {
        handlePlayPause();
      } else {
        playSong(securedSong);
      }
    }, [isCurrentSong, securedSong, playSong, handlePlayPause, onPressCallback]);

    const handleLongPress = useCallback(() => {
      setPlayerDrawerOpen(true);
    }, []);

    return (
      <View style={{ marginVertical: 2 }}>
        <PressableScale
          onPress={handlePress}
          onLongPress={disableOnLongPress ? undefined : handleLongPress}
          delayLongPress={350}
          scaleTo={0.98}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 8,
            borderRadius: 12,
            backgroundColor: isCurrentSong ? `${colors.primary}14` : 'transparent',
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Image
              source={{
                uri: securedSong.image[1]?.link || securedSong.image[0]?.link,
                cache: 'force-cache',
              }}
              style={{ width: '100%', height: '100%' }}
              alt='Song cover'
              fadeDuration={0}
              resizeMode='cover'
            />
            {isCurrentSong && (
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color='#fff' />
              </View>
            )}
          </View>

          <View style={{ flex: 1, paddingHorizontal: 12, justifyContent: 'center' }}>
            <Text
              style={{
                color: isCurrentSong ? colors.primary : colors.foreground,
                fontWeight: '600',
                fontSize: 14.5,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {securedSong.name}
            </Text>
            <Text
              style={{ color: colors.mutedForeground, fontSize: 12.5, marginTop: 2 }}
              numberOfLines={1}
            >
              {securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name}
            </Text>
          </View>

          <View style={{ paddingRight: 4, justifyContent: 'center' }}>
            <Ionicons
              name={isCurrentSong ? (isPlaying ? 'pause-circle' : 'play-circle') : 'play-outline'}
              size={22}
              color={isCurrentSong ? colors.primary : colors.mutedForeground}
            />
          </View>
        </PressableScale>

        {playerDrawerOpen && (
          <NewPlayerDrawer
            isVisible={true}
            onClose={() => setPlayerDrawerOpen(false)}
            song={securedSong}
          />
        )}
      </View>
    );
  }
);

/** Picks a cover whatever shape the API sent it in. Tier 2 is the 500px one, 1 the 150px one. */
const coverUrl = (image: unknown, tier: 0 | 1 | 2 = 2): string | undefined => {
  if (typeof image === 'string') return convertToHttps(image);
  if (!Array.isArray(image)) return undefined;
  const link = image[tier]?.link || image[1]?.link || image[0]?.link;
  return typeof link === 'string' ? convertToHttps(link) : undefined;
};

/**
 * One image view, rounded directly rather than clipped by a wrapper. `resizeMethod` decodes
 * Android bitmaps at the size shown, so a card doesn't hold a full 500px cover in memory.
 */
const coverProps = (uri: string | undefined) =>
  ({
    source: uri ? { uri, cache: 'force-cache' as const } : {},
    fadeDuration: 0,
    resizeMode: 'cover',
    resizeMethod: 'resize',
  }) as const;

const CardText = memo(function CardText({
  title,
  subtitle,
  titleColor,
  subtitleColor,
}: {
  title?: string;
  subtitle?: string;
  titleColor: string;
  subtitleColor: string;
}) {
  return (
    <View style={cardStyles.text}>
      <Text style={[cardStyles.title, { color: titleColor }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[cardStyles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
});

type CardWidth = { width?: number | `${number}%` };

/** Album: a record sliding out of its sleeve. */
export const AlbumCard = memo(
  ({ album, width, onPress: customOnPress, onLongPress }: AlbumCardProps & CardWidth) => {
    const { colors } = useTheme();
    const id = album?.album_id || album?.id;

    const handlePress = useCallback(() => {
      if (customOnPress) customOnPress();
      else router.push({ pathname: '/albums', params: { id } });
    }, [id, customOnPress]);

    if (!album) return null;

    const name = album.name || album.title || '';
    const artistName = typeof album.artist === 'object' ? album.artist?.name : album.artist;

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <View style={cardStyles.sleeve}>
          <View style={cardStyles.disc} />
          <Image
            {...coverProps(coverUrl(album.image))}
            style={[cardStyles.cover, cardStyles.sleeveCover, { backgroundColor: colors.raised }]}
            alt={`Album: ${name}`}
          />
        </View>
        <CardText
          title={name}
          subtitle={artistName || album.subtitle || album.artist_map?.artists?.[0]?.name || 'Album'}
          titleColor={colors.foreground}
          subtitleColor={colors.mutedForeground}
        />
      </CardContainer>
    );
  }
);

/** Playlist: a stack, with the edges of the songs underneath showing above the top cover. */
export const PlaylistCard = memo(
  ({ playlist, width, onPress: customOnPress, onLongPress }: PlaylistCardProps & CardWidth) => {
    const { colors } = useTheme();
    const id = playlist?.id;

    const handlePress = useCallback(() => {
      if (customOnPress) customOnPress();
      else router.push({ pathname: '/playlists', params: { id } });
    }, [id, customOnPress]);

    if (!playlist?.name || !playlist?.image) return null;

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <View style={cardStyles.stack}>
          <View style={[cardStyles.edgeBack, { backgroundColor: `${colors.foreground}14` }]} />
          <View style={[cardStyles.edgeFront, { backgroundColor: `${colors.foreground}2E` }]} />
          <Image
            {...coverProps(coverUrl(playlist.image))}
            style={[cardStyles.cover, { backgroundColor: colors.raised }]}
            alt={`Playlist: ${playlist.name}`}
          />
        </View>
        <CardText
          title={playlist.name}
          subtitle={playlist.subtitle || playlist.description || 'Playlist'}
          titleColor={colors.foreground}
          subtitleColor={colors.mutedForeground}
        />
      </CardContainer>
    );
  }
);

/** Song: just the cover. Bars in the corner mark the one playing, without hiding its art. */
export const NewSongCard = memo(({ song, width }: SongCardProps & CardWidth) => {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);

  if (!song.id) return null;

  return (
    <>
      <CardContainer width={width} onPress={onPress} onLongPress={onLongPress}>
        <View>
          <Image
            {...coverProps(coverUrl(song.image))}
            style={[cardStyles.cover, { backgroundColor: colors.raised }]}
            alt={`Song: ${song.name}`}
          />
          {isCurrentSong && (
            <View style={cardStyles.playing}>
              <PlayingBars color='#fff' active={isPlaying} />
            </View>
          )}
        </View>
        <CardText
          title={song.name}
          subtitle={song.subtitle || song.artist_map?.artists?.[0]?.name || 'Unknown Artist'}
          titleColor={isCurrentSong ? colors.primary : colors.foreground}
          subtitleColor={colors.mutedForeground}
        />
      </CardContainer>
      {options}
    </>
  );
});

/** Artist: a person, so a circle and just their name. */
export const ArtistCard = memo(
  ({ artist, width, onPress: customOnPress, onLongPress }: ArtistCardProps & CardWidth) => {
    const { colors } = useTheme();
    const id = artist?.id;

    const handlePress = useCallback(() => {
      if (customOnPress) customOnPress();
      else router.push({ pathname: '/artist', params: { id } });
    }, [id, customOnPress]);

    if (!artist?.name || !artist?.image) return null;

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <Image
          {...coverProps(coverUrl(artist.image))}
          style={[cardStyles.avatar, { backgroundColor: colors.raised }]}
          alt={`Artist: ${artist.name}`}
        />
        <Text style={[cardStyles.artistName, { color: colors.foreground }]} numberOfLines={1}>
          {artist.name}
        </Text>
      </CardContainer>
    );
  }
);

/** How far the record shows past the album sleeve. */
const DISC_PEEK = 12;

const cardStyles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  text: { marginTop: 8, gap: 1 },
  title: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.15, lineHeight: 18 },
  subtitle: { fontSize: 12, lineHeight: 16 },

  sleeve: { marginRight: DISC_PEEK },
  sleeveCover: { borderRadius: 4 },
  disc: {
    position: 'absolute',
    top: '3%',
    bottom: '3%',
    right: -DISC_PEEK,
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#1C1C1F',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  stack: { marginTop: 8 },
  edgeBack: {
    position: 'absolute',
    top: -8,
    left: 14,
    right: 14,
    height: 16,
    borderRadius: 7,
  },
  edgeFront: {
    position: 'absolute',
    top: -4,
    left: 7,
    right: 7,
    height: 16,
    borderRadius: 8,
  },

  playing: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },

  avatar: { width: '100%', aspectRatio: 1, borderRadius: 999 },
  artistName: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 17,
    textAlign: 'center',
  },
});

export const ProgressBar = memo(() => {
  const { colors } = useTheme();
  const { position, duration } = useProgress();

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View
      style={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
        height: 3,
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.min(100, progressPercent)}%`,
          backgroundColor: colors.primary,
          borderRadius: 2,
        }}
      />
    </View>
  );
});

export const GroupSongControls = memo(() => {
  const { position, duration } = useProgress();
  const { handleSeek } = useGroupMusic();

  return (
    <View className='w-full py-4'>
      <View className='flex-row items-center'>
        <CustomSlider
          value={position}
          maxValue={duration}
          onSeek={handleSeek}
          trackColor='#fff'
          inactiveTrackColor='rgba(127, 127, 127, 0.2)'
          thumbSize={12}
          trackHeight={4}
        />
      </View>
      <View className='flex-row justify-between'>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    width: 40,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderContainer: {
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
  },
});
