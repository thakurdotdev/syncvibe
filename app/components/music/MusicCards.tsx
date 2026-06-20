import { useGroupMusic } from '@/context/GroupMusicContext';
import { usePlayerControls, usePlaybackState, useShuffleMode, useRepeatMode, useCurrentSong } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { addToHistory } from '@/utils/api/addToHistory';
import {
  ensureHttpsForAlbumUrls,
  ensureHttpsForArtistUrls,
  ensureHttpsForPlaylistUrls,
  ensureHttpsForSongUrls,
} from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SkipBackIcon, SkipForwardIcon, Shuffle, Repeat, Repeat1 } from 'lucide-react-native';
import { memo, default as React, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import TrackPlayer, { State, useProgress } from 'react-native-track-player';
import Card from '../ui/card';
import NewPlayerDrawer from './NewPlayerDrawer';

interface SongCardProps {
  song: Song;
  onPress?: () => void | Promise<void>; // Optional callback for when song is clicked
}

interface AlbumCardProps {
  album: any;
}

interface PlaylistCardProps {
  playlist: any;
  isUser?: boolean;
}

interface ImageType {
  link: string;
}

interface ArtistCardProps {
  artist: { id: string; name: string; image: ImageType[] };
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

interface CardContainerProps {
  children: React.ReactNode;
  onPress: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
  width?: number | `${number}%`;
}

export const CardContainer = ({
  children,
  onPress,
  width = 160,
  onLongPress,
}: CardContainerProps) => {
  return (
    <Card variant='ghost' className='rounded-none border-none bg-none bg-transparent mb-2'>
      <Pressable
        style={{
          width: width,
          overflow: 'hidden',
        }}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {children}
      </Pressable>
    </Card>
  );
};

export const SongCard = memo(
  ({
    song,
    disableOnLongPress = false,
    onPress: onPressCallback,
  }: SongCardProps & { disableOnLongPress?: boolean }) => {
    const { playSong, handlePlayPause } = usePlayerControls();
    const { currentSong, isPlaying, isLoading } = usePlaybackState();
    const { colors } = useTheme();

    const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song]);
    const isCurrentSong = currentSong?.id === securedSong.id;
    const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

    const handlePress = useCallback(async () => {
      // Call the optional callback first
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    return (
      <Card
        variant={isCurrentSong ? 'secondary' : 'ghost'}
        className='h-[60px] p-0 rounded-lg bg-transparent border-none mb-2'
      >
        <Card.Content className='p-0 rounded-none'>
          <Pressable
            onPress={handlePress}
            onLongPress={disableOnLongPress ? undefined : handleLongPress}
            className='w-full flex-row rounded-none h-[60px]'
          >
            <View className='relative'>
              <Image
                source={{ uri: securedSong.image[1]?.link }}
                style={{ width: 56, height: 60 }}
                alt='Song cover'
                fadeDuration={0}
                resizeMode='cover'
                className='rounded-l-md'
              />
            </View>

            <View className='flex-1 p-3 px-4 justify-center'>
              <Text
                style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}
                numberOfLines={1}
              >
                {securedSong.name}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }} numberOfLines={1}>
                {securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name}
              </Text>
            </View>

            {isCurrentSong ? (
              <View className='flex-row items-center justify-center pr-2'>
                {isLoading ? (
                  <ActivityIndicator size='small' color={colors.primary} />
                ) : (
                  <>
                    <View className='ml-3'>
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                  </>
                )}
              </View>
            ) : (
              <View className='justify-center pr-2'>
                <Ionicons name='play' size={22} color={colors.text} />
              </View>
            )}
          </Pressable>
        </Card.Content>

        {playerDrawerOpen && (
          <NewPlayerDrawer
            isVisible={true}
            onClose={() => setPlayerDrawerOpen(false)}
            song={securedSong}
          />
        )}
      </Card>
    );
  }
);

export const CardImage = ({ uri, alt }: { uri: string; alt: string }) => (
  <View style={{ width: '100%', height: 140, borderRadius: 5, overflow: 'hidden' }}>
    <Image
      source={{ uri: uri || 'https://via.placeholder.com/140' }}
      style={{ width: '100%', height: '100%' }}
      resizeMode='cover'
      alt={alt}
    />
  </View>
);

export const AlbumCard = memo(({ album }: AlbumCardProps) => {
  const { colors } = useTheme();
  const handlePress = useCallback(() => {
    router.push({
      pathname: '/albums',
      params: { id: album.album_id || album?.id },
    });
  }, [album.album_id || album?.id]);

  if (!album) return null;

  // Apply HTTPS conversion to the album object
  const securedAlbum = useMemo(() => ensureHttpsForAlbumUrls(album), [album]);

  const name = securedAlbum.name || securedAlbum.title || '';
  const imageUrl = securedAlbum.image?.[2]?.link || securedAlbum.image?.[2]?.url;

  return (
    <CardContainer onPress={handlePress}>
      <View style={{ padding: 12, gap: 8 }}>
        <CardImage uri={imageUrl} alt={`Album: ${name}`} />
        <Text
          style={{
            color: colors.text,
            fontWeight: '600',
            fontSize: 14,
            paddingHorizontal: 4,
          }}
          numberOfLines={1}
          ellipsizeMode='tail'
        >
          {name}
        </Text>
      </View>
    </CardContainer>
  );
});

export const PlaylistCard = memo(({ playlist, isUser = false }: PlaylistCardProps) => {
  const { colors } = useTheme();
  const handlePress = useCallback(() => {
    router.push({
      pathname: isUser ? '/user-playlist' : '/playlists',
      params: { id: playlist.id },
    });
  }, [playlist?.id]);

  if (!playlist?.name || !playlist?.image) return null;

  // Apply HTTPS conversion to the playlist object
  const securedPlaylist = useMemo(() => ensureHttpsForPlaylistUrls(playlist), [playlist]);

  const subtitle = securedPlaylist.subtitle || securedPlaylist.description || 'Playlist';
  const imageUrl = Array.isArray(securedPlaylist.image)
    ? securedPlaylist.image[2]?.link
    : securedPlaylist.image;

  return (
    <CardContainer onPress={handlePress} key={securedPlaylist.id} width={isUser ? '100%' : 160}>
      <View style={{ padding: 12, gap: 8 }}>
        <CardImage uri={imageUrl} alt={`Playlist: ${securedPlaylist.name}`} />
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text
            style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {securedPlaylist.name}
          </Text>
          <Text
            style={{ color: colors.mutedForeground, fontSize: 12 }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </CardContainer>
  );
});

export const NewSongCard = memo(({ song }: SongCardProps) => {
  if (!song.id) return null;
  const { playSong, handlePlayPause } = usePlayerControls();
  const { currentSong, isPlaying } = usePlaybackState();
  const { colors } = useTheme();
  const isCurrentSong = currentSong?.id === song.id;
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);

  const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song]);

  const imageUrl = securedSong.image?.[2]?.link || securedSong.image?.[1]?.link;
  const artistName =
    securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name || 'Unknown Artist';

  const handlePress = () => {
    if (isCurrentSong) {
      handlePlayPause();
    } else {
      playSong(securedSong);
    }
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerDrawerOpen(true);
  };

  const accentColor = colors.background || 'rgb(99, 102, 241)';

  return (
    <>
      <CardContainer width={160} onPress={handlePress} onLongPress={handleLongPress}>
        <View className='p-3'>
          <CardImage uri={imageUrl} alt={`Song: ${securedSong.name}`} />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 6,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isCurrentSong ? 1 : 0,
            }}
          >
            <View
              style={{
                padding: 8,
                borderRadius: 50,
                backgroundColor: isCurrentSong ? accentColor : 'rgba(0, 0, 0, 0.5)',
              }}
            >
              <Ionicons
                name={isCurrentSong && isPlaying ? 'pause' : 'play'}
                size={24}
                color={colors.text}
              />
            </View>
          </View>

          <View className='pt-1'>
            <Text
              style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {securedSong.name}
            </Text>
            <Text
              style={{ color: colors.mutedForeground, fontSize: 12 }}
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
});

export const ArtistCard = memo(({ artist }: ArtistCardProps) => {
  const { colors } = useTheme();

  if (!artist?.name || !artist?.image) return null;

  // Apply HTTPS conversion to the artist object
  const securedArtist = useMemo(() => ensureHttpsForArtistUrls(artist), [artist]);

  const imageUrl = useMemo(
    () => (Array.isArray(securedArtist.image) ? securedArtist.image[2]?.link : securedArtist.image),
    [securedArtist.image]
  );

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/artist',
      params: { id: securedArtist.id },
    });
  }, [securedArtist?.id]);

  return (
    <CardContainer onPress={handlePress}>
      <View style={{ padding: 12, gap: 8 }}>
        <CardImage uri={imageUrl} alt={`Artist: ${securedArtist.name}`} />
        <Text
          style={{
            color: colors.text,
            fontWeight: '500',
            fontSize: 14,
            paddingHorizontal: 4,
          }}
          numberOfLines={1}
          ellipsizeMode='tail'
        >
          {securedArtist.name}
        </Text>
      </View>
    </CardContainer>
  );
});

export const SongControls = memo(() => {
  const { handleNextSong, handlePrevSong, handlePlayPause: triggerPlayPause } = usePlayerControls();
  const { shuffleMode, toggleShuffle } = useShuffleMode();
  const { repeatMode, toggleRepeat } = useRepeatMode();
  const { isPlaying } = usePlaybackState();
  const currentSong = useCurrentSong();
  const prevSongIdRef = useRef<string | null>(null);
  const isDragging = useRef(false);
  const { position, duration } = useProgress();
  const { colors } = useTheme();

  const progress = useSharedValue(position);
  const min = useSharedValue(0);
  const max = useSharedValue(duration);
  const playScale = useSharedValue(1);

  useEffect(() => {
    const isSongChanged = currentSong?.id !== prevSongIdRef.current;
    prevSongIdRef.current = currentSong?.id ?? null;

    if (isSongChanged) {
      progress.value = position;
      max.value = duration;
    } else {
      if (!isDragging.current) {
        progress.value = withTiming(position, { duration: 1000, easing: Easing.linear });
      }
      max.value = withTiming(duration, { duration: 1000, easing: Easing.linear });
    }
  }, [position, duration, currentSong?.id]);

  useEffect(() => {
    playScale.value = withSpring(0.85, { damping: 8, stiffness: 400 });
    const timeout = setTimeout(() => {
      playScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isPlaying]);

  const playButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerPlayPause();
  };

  const handleSeek = async (value: number) => {
    await TrackPlayer.seekTo(value);
  };

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleShuffle();
  };

  const handleRepeat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <Slider
          style={songControlStyles.slider}
          progress={progress}
          minimumValue={min}
          maximumValue={max}
          onSlidingStart={() => {
            isDragging.current = true;
          }}
          onValueChange={(value) => {
            progress.value = value;
          }}
          onSlidingComplete={(value) => {
            handleSeek(value);
            isDragging.current = false;
          }}
          thumbWidth={14}
          sliderHeight={4}
          containerStyle={songControlStyles.sliderContainer}
          theme={{
            minimumTrackTintColor: colors.primary,
            maximumTrackTintColor: colors.mutedForeground + '30',
            bubbleBackgroundColor: colors.primary,
          }}
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
        <TouchableOpacity
          onPress={handleShuffle}
          activeOpacity={0.7}
          style={songControlStyles.sideControl}
        >
          <Shuffle
            size={20}
            color={shuffleMode ? colors.primary : colors.mutedForeground}
            strokeWidth={shuffleMode ? 2.5 : 1.8}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePrevSong}
          activeOpacity={0.7}
          style={songControlStyles.skipControl}
        >
          <SkipBackIcon size={26} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>

        <Animated.View style={playButtonAnimStyle}>
          <TouchableOpacity
            style={[
              songControlStyles.playButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handlePlayPause}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={30}
              color={colors.primaryForeground}
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          onPress={() => handleNextSong()}
          activeOpacity={0.7}
          style={songControlStyles.skipControl}
        >
          <SkipForwardIcon size={26} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRepeat}
          activeOpacity={0.7}
          style={songControlStyles.sideControl}
        >
          <RepeatIcon
            size={20}
            color={repeatMode !== 'off' ? colors.primary : colors.mutedForeground}
            strokeWidth={repeatMode !== 'off' ? 2.5 : 1.8}
          />
        </TouchableOpacity>
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
  const currentSong = useCurrentSong();
  const prevSongIdRef = useRef<string | null>(null);

  const progress = useSharedValue(position);
  const min = useSharedValue(0);
  const max = useSharedValue(duration);

  useEffect(() => {
    const isSongChanged = currentSong?.id !== prevSongIdRef.current;
    prevSongIdRef.current = currentSong?.id ?? null;

    if (isSongChanged) {
      progress.value = position;
      max.value = duration;
    } else {
      progress.value = withTiming(position, { duration: 1000, easing: Easing.linear });
      max.value = withTiming(duration, { duration: 1000, easing: Easing.linear });
    }
  }, [position, duration, currentSong?.id]);

  return (
    <View style={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
      <Slider
        progress={progress}
        minimumValue={min}
        maximumValue={max}
        thumbWidth={0}
        sliderHeight={3}
        theme={{
          minimumTrackTintColor: colors.primary,
          maximumTrackTintColor: 'transparent',
          bubbleBackgroundColor: colors.primary,
        }}
      />
    </View>
  );
});

export const GroupSongControls = memo(() => {
  const isDragging = useRef(false);
  const { position, duration } = useProgress();
  const { handleSeek } = useGroupMusic();

  const progress = useSharedValue(position);
  const min = useSharedValue(0);
  const max = useSharedValue(duration);

  useEffect(() => {
    progress.value = withTiming(position);
    max.value = withTiming(duration);
  }, [position, duration]);

  return (
    <View className='w-full py-4'>
      <View className='flex-row items-center'>
        <Slider
          style={styles.slider}
          progress={progress}
          minimumValue={min}
          maximumValue={max}
          onSlidingStart={() => {
            isDragging.current = true;
          }}
          onValueChange={(value) => {
            progress.value = value;
          }}
          onSlidingComplete={(value) => {
            handleSeek(value);
            isDragging.current = false;
          }}
          thumbWidth={12}
          containerStyle={styles.sliderContainer}
          theme={{
            minimumTrackTintColor: '#fff',
            maximumTrackTintColor: 'rgba(99, 102, 241, 0.2)',
            bubbleBackgroundColor: '#6366f1',
          }}
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
