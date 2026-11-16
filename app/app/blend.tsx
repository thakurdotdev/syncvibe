import { playStationFrom } from '@/components/music/home/playStation';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import Button from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { useBlend } from '@/queries/usePersonal';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Avatar = ({ name, uri, size }: { name?: string; uri?: string | null; size: number }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.raised,
          borderColor: colors.background,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : (
        <Text style={[styles.avatarLetter, { color: colors.foreground }]}>{name?.[0] ?? '?'}</Text>
      )}
    </View>
  );
};

/** A mix of your taste and a friend's, the same for both of you today. */
export default function BlendScreen() {
  const { colors } = useTheme();
  const { user } = useUser();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data: blend, isLoading, error } = useBlend(userId);
  const message =
    (error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error ??
    "Couldn't make this Blend. Try again later.";
  const first = blend?.partner.name.split(' ')[0] ?? '';

  const renderSong = ({ item, index }: { item: Song; index: number }) => {
    const side = blend?.sides[item.id];
    const art = item.image?.[1]?.link || item.image?.[0]?.link;
    const tag = side === 'both' ? 'Both of you' : side === 'you' ? 'You' : side ? first : null;
    return (
      <PressableScale
        onPress={() => blend && playStationFrom(blend.songs, index)}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`Play ${item.name}${tag ? `, from ${tag}` : ''}`}
        style={styles.row}
      >
        <Image
          source={{ uri: art ? convertToHttps(art) : undefined }}
          style={[styles.art, { backgroundColor: colors.raised }]}
        />
        <View style={styles.rowText}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.artist_map?.primary_artists?.[0]?.name ?? ''}
          </Text>
        </View>
        {tag && (
          <View
            style={[
              styles.tag,
              { backgroundColor: side === 'both' ? colors.primary : colors.raised },
            ]}
          >
            <Text
              style={[
                styles.tagText,
                { color: side === 'both' ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {tag}
            </Text>
          </View>
        )}
      </PressableScale>
    );
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StackHeader title='Blend' />
      {isLoading ? (
        <ActivityIndicator style={styles.center} color={colors.mutedForeground} />
      ) : !blend ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Blend yet</Text>
          <Text style={[styles.sub, styles.centerText, { color: colors.mutedForeground }]}>
            {message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={blend.songs}
          keyExtractor={(song) => song.id}
          renderItem={renderSong}
          contentContainerStyle={[styles.list, { paddingBottom: DECK_CLEARANCE }]}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.avatars}>
                <Avatar name={user?.name} uri={user?.profilepic} size={56} />
                <View style={styles.overlap}>
                  <Avatar name={blend.partner.name} uri={blend.partner.profilepic} size={56} />
                </View>
              </View>
              <Text style={[styles.heading, { color: colors.foreground }]}>You + {first}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                A Blend of both your tastes, new every day
              </Text>
              <Button
                title='Play'
                icon={<Ionicons name='play' size={16} color={colors.primaryForeground} />}
                onPress={() => playStationFrom(blend.songs, 0)}
                style={styles.play}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 48 },
  centerText: { textAlign: 'center' },
  list: { paddingHorizontal: 16 },
  header: { alignItems: 'flex-start', gap: 6, paddingBottom: 16 },
  avatars: { flexDirection: 'row', marginBottom: 6 },
  overlap: { marginLeft: -14 },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarLetter: { fontSize: 20, fontWeight: '700' },
  heading: { fontFamily: fonts.displaySemibold, fontSize: 26, letterSpacing: -0.5 },
  play: { borderRadius: 999, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 64 },
  art: { width: 48, height: 48, borderRadius: 8 },
  rowText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 1 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11.5, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 72 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
});
