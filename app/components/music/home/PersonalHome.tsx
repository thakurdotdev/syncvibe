import type { FriendActivity } from '@/api/personal';
import PressableScale from '@/components/ui/PressableScale';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { useFriendsNow, useRecap } from '@/queries/usePersonal';
import { fonts } from '@/theme/typography';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playStationFrom } from './playStation';

const SIDE_MARGIN = 16;

const FriendCard = memo(function FriendCard({ friend }: { friend: FriendActivity }) {
  const { colors } = useTheme();
  const { joinGroup } = useGroupMusic();
  const { user, song, room } = friend;
  const art = song?.image?.[1]?.link || song?.image?.[0]?.link;
  const detail = room ? `In ${room.name}` : (song?.name ?? '');

  const act = () => {
    if (room) {
      joinGroup(room.id);
      router.navigate('/(tabs)/group-music');
    } else if (song) {
      playStationFrom([song], 0);
    }
  };

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      accessibilityLabel={`${user.name}: ${detail}`}
    >
      <View>
        {art ? (
          <Image
            source={{ uri: convertToHttps(art) }}
            style={[styles.art, { backgroundColor: colors.raised }]}
          />
        ) : (
          <View style={[styles.art, styles.artEmpty, { backgroundColor: colors.raised }]}>
            <Ionicons name='people' size={20} color={colors.mutedForeground} />
          </View>
        )}
        <View style={[styles.avatar, { backgroundColor: colors.raised, borderColor: colors.card }]}>
          {user.profilepic ? (
            <Image source={{ uri: user.profilepic }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.foreground }]}>
              {user.name?.[0] ?? '?'}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <PressableScale
        onPress={act}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={room ? `Join ${user.name} in ${room.name}` : `Play ${detail}`}
        style={[styles.action, { backgroundColor: room ? colors.primary : colors.raised }]}
      >
        <Text
          style={[
            styles.actionText,
            { color: room ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {room ? 'Join' : 'Play'}
        </Text>
      </PressableScale>
    </View>
  );
});

/** Friends who follow you back, and what they're playing right now. */
export const FriendsStrip = memo(function FriendsStrip() {
  const { colors } = useTheme();
  const { data: friends = [] } = useFriendsNow();
  if (!friends.length) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.foreground }]}>Friends listening now</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {friends.map((friend) => (
          <FriendCard key={friend.user.userid} friend={friend} />
        ))}
      </ScrollView>
    </View>
  );
});

/** A way into this week's recap, with the headline number. */
export const WeekRow = memo(function WeekRow() {
  const { colors } = useTheme();
  const { data: recap } = useRecap();
  if (!recap?.minutes) return null;
  const top = recap.topArtists?.[0]?.name;

  return (
    <PressableScale
      onPress={() => router.push('/recap')}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`Your week in music: ${recap.minutes} minutes`}
      style={styles.weekRow}
    >
      <View style={[styles.weekIcon, { backgroundColor: colors.raised }]}>
        <Ionicons name='sparkles' size={17} color={colors.foreground} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.weekTitle, { color: colors.foreground }]}>Your week in music</Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {recap.minutes} minutes{top ? ` · mostly ${top}` : ''}
        </Text>
      </View>
      <Ionicons name='chevron-forward' size={17} color={colors.mutedForeground} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 12 },
  label: {
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    letterSpacing: -0.3,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: SIDE_MARGIN,
  },
  row: { paddingHorizontal: SIDE_MARGIN, gap: 10 },
  card: {
    width: 264,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  art: { width: 48, height: 48, borderRadius: 12 },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatar: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 11, fontWeight: '700' },
  cardText: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600' },
  detail: { fontSize: 12.5, marginTop: 1 },
  action: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
    paddingHorizontal: SIDE_MARGIN,
    marginTop: 8,
  },
  weekIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
});
