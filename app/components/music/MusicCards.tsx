import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import {
  usePlayerControls,
  useRepeatMode,
  usePlaybackState,
  useSongPlaybackState,
  useShuffleMode,
} from '@/stores/playerStore';
import { Album, Artist, Playlist } from '@/types/music';
import { Song } from '@/types/song';
import {
  ensureHttpsForAlbumUrls,
  ensureHttpsForArtistUrls,
  ensureHttpsForPlaylistUrls,
  ensureHttpsForSongUrls,
} from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer, { useProgress } from '@rntp/player';
import { router } from 'expo-router';
import { Repeat, Repeat1, Shuffle, SkipBackIcon, SkipForwardIcon } from 'lucide-react-native';
import { memo, default as React, useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import NewPlayerDrawer from './NewPlayerDrawer';

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
  isUser?: boolean;
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
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          {
            width: width ?? '100%',
            transform: [{ scale: pressed ? 0.97 : 1 }],
            opacity: pressed ? 0.9 : 1,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
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
        <Pressable
          onPress={handlePress}
          onLongPress={disableOnLongPress ? undefined : handleLongPress}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 7,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: isCurrentSong
                ? isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(0,0,0,0.04)'
                : pressed
                  ? isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.02)'
                  : 'transparent',
            },
          ]}
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
        </Pressable>

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

export const CardImage = ({ uri, alt }: { uri: string; alt: string }) => {
  const fallback =
    'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp';
  const sourceUri = uri && typeof uri === 'string' && uri.trim() !== '' ? uri : fallback;

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Image
        source={{ uri: sourceUri, cache: 'force-cache' }}
        style={{ width: '100%', height: '100%' }}
        resizeMode='cover'
        alt={alt}
      />
    </View>
  );
};

export const AlbumCard = memo(
  ({
    album,
    width,
    onPress: customOnPress,
    onLongPress,
  }: AlbumCardProps & { width?: number | `${number}%` }) => {
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress();
      } else {
        router.push({
          pathname: '/albums',
          params: { id: album.album_id || album?.id },
        });
      }
    }, [album?.album_id || album?.id, customOnPress]);

    if (!album) return null;

    const securedAlbum = useMemo(() => ensureHttpsForAlbumUrls(album), [album]);
    const name = securedAlbum.name || securedAlbum.title || '';
    const artistName =
      typeof securedAlbum.artist === 'object' ? securedAlbum.artist?.name : securedAlbum.artist;
    const subtitle =
      artistName || securedAlbum.subtitle || securedAlbum.artist_map?.artists?.[0]?.name || 'Album';
    const imageUrl = Array.isArray(securedAlbum.image)
      ? securedAlbum.image[2]?.link || securedAlbum.image[1]?.link || securedAlbum.image[0]?.link
      : typeof securedAlbum.image === 'string'
        ? securedAlbum.image
        : undefined;

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <View style={cardStyles.container}>
          <View
            style={[
              cardStyles.imageCover,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <Image
              source={{ uri: imageUrl || 'https://via.placeholder.com/150', cache: 'force-cache' }}
              style={cardStyles.image}
              resizeMode='cover'
              alt={`Album: ${name}`}
            />
          </View>

          <View style={cardStyles.textContainer}>
            <Text
              style={[cardStyles.primaryText, { color: colors.foreground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {name}
            </Text>
            <Text
              style={[cardStyles.secondaryText, { color: colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </CardContainer>
    );
  }
);

export const PlaylistCard = memo(
  ({
    playlist,
    isUser = false,
    width,
    onPress: customOnPress,
    onLongPress,
  }: PlaylistCardProps & { width?: number | `${number}%` }) => {
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress();
      } else {
        router.push({
          pathname: isUser ? '/user-playlist' : '/playlists',
          params: { id: playlist.id },
        });
      }
    }, [playlist?.id, isUser, customOnPress]);

    if (!playlist?.name || !playlist?.image) return null;

    const securedPlaylist = useMemo(() => ensureHttpsForPlaylistUrls(playlist), [playlist]);
    const subtitle = securedPlaylist.subtitle || securedPlaylist.description || 'Playlist';
    const imageUrl = Array.isArray(securedPlaylist.image)
      ? securedPlaylist.image[2]?.link ||
        securedPlaylist.image[1]?.link ||
        securedPlaylist.image[0]?.link
      : typeof securedPlaylist.image === 'string'
        ? securedPlaylist.image
        : undefined;

    if (isUser) {
      return (
        <CardContainer
          onPress={handlePress}
          onLongPress={onLongPress}
          width='100%'
          style={{ marginBottom: 8 }}
        >
          <View
            style={[
              cardStyles.userPlaylistRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border + '35',
              },
            ]}
          >
            <View
              style={[
                cardStyles.userPlaylistImage,
                {
                  backgroundColor: colors.muted,
                },
              ]}
            >
              <Image
                source={{ uri: imageUrl, cache: 'force-cache' }}
                style={{ width: '100%', height: '100%' }}
                resizeMode='cover'
                alt={`Playlist: ${securedPlaylist.name}`}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ color: colors.foreground, fontWeight: '600', fontSize: 14.5 }}
                numberOfLines={1}
              >
                {securedPlaylist.name}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12.5 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <Ionicons name='chevron-forward' size={18} color={colors.mutedForeground} />
          </View>
        </CardContainer>
      );
    }

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <View style={cardStyles.container}>
          <View
            style={[
              cardStyles.imageCover,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <Image
              source={{ uri: imageUrl, cache: 'force-cache' }}
              style={cardStyles.image}
              resizeMode='cover'
              alt={`Playlist: ${securedPlaylist.name}`}
            />
          </View>

          <View style={cardStyles.textContainer}>
            <Text
              style={[cardStyles.primaryText, { color: colors.foreground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {securedPlaylist.name}
            </Text>
            <Text
              style={[cardStyles.secondaryText, { color: colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </CardContainer>
    );
  }
);

export const NewSongCard = memo(
  ({ song, width }: SongCardProps & { width?: number | `${number}%` }) => {
    if (!song.id) return null;
    const { playSong, handlePlayPause } = usePlayerControls();
    const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id);
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';
    const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

    const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song]);
    const imageUrl =
      securedSong.image?.[2]?.link || securedSong.image?.[1]?.link || securedSong.image?.[0]?.link;
    const artistName =
      securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name || 'Unknown Artist';

    const handlePress = useCallback(() => {
      if (isCurrentSong) {
        handlePlayPause();
      } else {
        playSong(securedSong);
      }
    }, [isCurrentSong, handlePlayPause, playSong, securedSong]);

    const handleLongPress = useCallback(() => {
      setPlayerDrawerOpen(true);
    }, []);

    return (
      <>
        <CardContainer width={width} onPress={handlePress} onLongPress={handleLongPress}>
          <View style={cardStyles.container}>
            <View
              style={[
                cardStyles.imageCover,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <Image
                source={{ uri: imageUrl, cache: 'force-cache' }}
                style={cardStyles.image}
                resizeMode='cover'
                alt={`Song: ${securedSong.name}`}
              />

              {/* Active Playing Overlay */}
              {isCurrentSong && (
                <View
                  style={{
                    ...StyleSheet.absoluteFill,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={18}
                      color={colors.primaryForeground}
                      style={isPlaying ? undefined : { marginLeft: 2 }}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={cardStyles.textContainer}>
              <Text
                style={[
                  cardStyles.primaryText,
                  { color: isCurrentSong ? colors.primary : colors.foreground },
                ]}
                numberOfLines={1}
                ellipsizeMode='tail'
              >
                {securedSong.name}
              </Text>
              <Text
                style={[cardStyles.secondaryText, { color: colors.mutedForeground }]}
                numberOfLines={1}
                ellipsizeMode='tail'
              >
                {artistName}
              </Text>
            </View>
          </View>
        </CardContainer>

        {playerDrawerOpen && (
          <NewPlayerDrawer
            isVisible={playerDrawerOpen}
            onClose={() => setPlayerDrawerOpen(false)}
            song={securedSong}
          />
        )}
      </>
    );
  }
);

export const ArtistCard = memo(
  ({
    artist,
    width,
    onPress: customOnPress,
    onLongPress,
  }: ArtistCardProps & { width?: number | `${number}%` }) => {
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    if (!artist?.name || !artist?.image) return null;

    const securedArtist = useMemo(() => ensureHttpsForArtistUrls(artist), [artist]);
    const imageUrl = useMemo(
      () =>
        Array.isArray(securedArtist.image)
          ? securedArtist.image[2]?.link ||
            securedArtist.image[1]?.link ||
            securedArtist.image[0]?.link
          : typeof securedArtist.image === 'string'
            ? securedArtist.image
            : undefined,
      [securedArtist.image]
    );

    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress();
      } else {
        router.push({
          pathname: '/artist',
          params: { id: securedArtist.id },
        });
      }
    }, [securedArtist?.id, customOnPress]);

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={width}>
        <View style={cardStyles.artistContainer}>
          <View
            style={[
              cardStyles.artistAvatarWrapper,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Image
              source={{ uri: imageUrl || 'https://via.placeholder.com/120', cache: 'force-cache' }}
              style={cardStyles.artistAvatar}
              resizeMode='cover'
              alt={`Artist: ${securedArtist.name}`}
            />
          </View>

          <View style={cardStyles.artistTextContainer}>
            <Text
              style={[cardStyles.primaryText, { color: colors.foreground, textAlign: 'center' }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {securedArtist.name}
            </Text>
            <Text
              style={[
                cardStyles.secondaryText,
                { color: colors.mutedForeground, textAlign: 'center' },
              ]}
              numberOfLines={1}
            >
              Artist
            </Text>
          </View>
        </View>
      </CardContainer>
    );
  }
);

const cardStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  imageCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    gap: 2,
    paddingHorizontal: 1,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  secondaryText: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 16,
  },
  artistContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  artistAvatarWrapper: {
    width: '100%',
    maxWidth: 136,
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
  },
  artistAvatar: {
    width: '100%',
    height: '100%',
  },
  artistTextContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  userPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  userPlaylistImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export const SongControls = memo(() => {
  const { handleNextSong, handlePrevSong, handlePlayPause: triggerPlayPause } = usePlayerControls();
  const { shuffleMode, toggleShuffle } = useShuffleMode();
  const { repeatMode, toggleRepeat } = useRepeatMode();
  const { isPlaying } = usePlaybackState();
  const { position, duration } = useProgress(0.25);
  const { colors } = useTheme();

  const handlePlayPause = () => {
    triggerPlayPause();
  };

  const handleSeek = async (value: number) => {
    await TrackPlayer.seekTo(value);
  };

  const handleShuffle = () => {
    toggleShuffle();
  };

  const handleRepeat = () => {
    toggleRepeat();
  };

  const getRepeatIcon = () => {
    if (repeatMode === 'one') return Repeat1;
    return Repeat;
  };

  const RepeatIcon = getRepeatIcon();

  return (
    <View style={songControlStyles.container}>
      <View style={songControlStyles.sliderRow}>
        <CustomSlider
          value={position}
          maxValue={duration}
          onSeek={handleSeek}
          trackColor={colors.primary}
          inactiveTrackColor={colors.mutedForeground + '30'}
          thumbSize={14}
          trackHeight={4}
        />
      </View>
      <View style={songControlStyles.timeRow}>
        <Text style={[songControlStyles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(position)}
        </Text>
        <Text style={[songControlStyles.timeText, { color: colors.mutedForeground }]}>
          -{formatTime(Math.max(0, duration - position))}
        </Text>
      </View>

      <View style={songControlStyles.controls}>
        <Pressable
          onPress={handleShuffle}
          style={({ pressed }) => [songControlStyles.sideControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Shuffle
            size={20}
            color={shuffleMode ? colors.primary : colors.mutedForeground}
            strokeWidth={shuffleMode ? 2.5 : 1.8}
          />
        </Pressable>

        <Pressable
          onPress={handlePrevSong}
          style={({ pressed }) => [songControlStyles.skipControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <SkipBackIcon size={26} color={colors.text} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            songControlStyles.playButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handlePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={30}
            color={colors.primaryForeground}
            style={isPlaying ? undefined : { marginLeft: 3 }}
          />
        </Pressable>

        <Pressable
          onPress={() => handleNextSong()}
          style={({ pressed }) => [songControlStyles.skipControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <SkipForwardIcon size={26} color={colors.text} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPress={handleRepeat}
          style={({ pressed }) => [songControlStyles.sideControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <RepeatIcon
            size={20}
            color={repeatMode !== 'off' ? colors.primary : colors.mutedForeground}
            strokeWidth={repeatMode !== 'off' ? 2.5 : 1.8}
          />
        </Pressable>
      </View>
    </View>
  );
});

const songControlStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderContainer: {
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: -4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  sideControl: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipControl: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
          inactiveTrackColor='rgba(99, 102, 241, 0.2)'
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
