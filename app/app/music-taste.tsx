import { searchArtists, type TasteArtist } from '@/api/personal';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { SettingsGroup, SettingsRow } from '@/components/profile/SettingsGroup';
import { StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import Input from '@/components/ui/input';
import Toggle from '@/components/ui/Toggle';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { useSaveTaste, useTaste } from '@/queries/usePersonal';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_ARTISTS = 20;

/** Searches artists a moment after typing stops. */
const useArtistSearch = (query: string) => {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  return useQuery({
    queryKey: ['artistSearch', debounced.trim().toLowerCase()],
    queryFn: () => searchArtists(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
  });
};

const ArtistAvatar = ({ artist, size }: { artist: TasteArtist; size: number }) => {
  const { colors } = useTheme();
  return artist.image ? (
    <Image
      source={{ uri: convertToHttps(artist.image) }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.raised }}
    />
  ) : (
    <View
      style={[
        styles.letter,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.raised },
      ]}
    >
      <Text style={{ color: colors.foreground, fontWeight: '700' }}>{artist.name[0]}</Text>
    </View>
  );
};

/**
 * Artists you love (they start your recommendations before you've played much) and whether
 * friends see what you're playing. Saved to your account as you change them.
 */
export default function MusicTasteScreen() {
  const { colors } = useTheme();
  const { data: taste, isLoading } = useTaste();
  const { mutate: save } = useSaveTaste();
  const [query, setQuery] = useState('');
  const { data: results = [], isFetching } = useArtistSearch(query);
  const artists = taste?.artists ?? [];

  const saveArtists = (next: TasteArtist[]) =>
    save(
      { artists: next },
      { onError: () => toast("Couldn't save. Try again.", { type: 'error' }) }
    );

  const add = (artist: TasteArtist) => {
    if (artists.some((a) => a.id === artist.id)) return;
    if (artists.length >= MAX_ARTISTS) {
      toast(`Up to ${MAX_ARTISTS} artists`);
      return;
    }
    saveArtists([...artists, artist]);
    setQuery('');
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StackHeader title='Music taste' />
      {isLoading || !taste ? (
        <ActivityIndicator style={styles.center} color={colors.mutedForeground} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={{ paddingBottom: DECK_CLEARANCE }}
        >
          <SettingsGroup title='Artists you love'>
            <View style={styles.block}>
              <Text style={[styles.help, { color: colors.mutedForeground }]}>
                New here? These start your recommendations until you&apos;ve played a few songs.
              </Text>
              {artists.length > 0 && (
                <View style={styles.chips}>
                  {artists.map((artist) => (
                    <View key={artist.id} style={[styles.chip, { backgroundColor: colors.raised }]}>
                      <ArtistAvatar artist={artist} size={26} />
                      <Text
                        style={[styles.chipText, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {artist.name}
                      </Text>
                      <PressableScale
                        onPress={() => saveArtists(artists.filter((a) => a.id !== artist.id))}
                        hitSlop={8}
                        accessibilityRole='button'
                        accessibilityLabel={`Remove ${artist.name}`}
                        style={styles.remove}
                      >
                        <Ionicons name='close' size={15} color={colors.mutedForeground} />
                      </PressableScale>
                    </View>
                  ))}
                </View>
              )}
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder='Search artists'
                accessibilityLabel='Search artists'
                autoCorrect={false}
                leftIcon={<Ionicons name='search' size={17} color={colors.mutedForeground} />}
              />
              {isFetching && <ActivityIndicator color={colors.mutedForeground} />}
              {query.trim().length >= 2 &&
                results.map((artist) => {
                  const added = artists.some((a) => a.id === artist.id);
                  return (
                    <PressableScale
                      key={artist.id}
                      onPress={() => add(artist)}
                      disabled={added}
                      scaleTo={ROW_PRESS_SCALE}
                      accessibilityRole='button'
                      accessibilityLabel={added ? `${artist.name}, added` : `Add ${artist.name}`}
                      style={[styles.result, { opacity: added ? 0.6 : 1 }]}
                    >
                      <ArtistAvatar artist={artist} size={38} />
                      <Text
                        style={[styles.resultText, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {artist.name}
                      </Text>
                      <Ionicons
                        name={added ? 'checkmark' : 'add'}
                        size={20}
                        color={colors.mutedForeground}
                      />
                    </PressableScale>
                  );
                })}
            </View>
          </SettingsGroup>

          <SettingsGroup title='Friends'>
            <SettingsRow
              icon='radio'
              label="Share what I'm playing"
              detail='Friends who follow you back see it and can make a Blend with you'
              trailing={
                <Toggle
                  value={taste.shareListening}
                  onValueChange={(value) => save({ shareListening: value })}
                  accessibilityLabel="Share what I'm playing"
                />
              }
            />
          </SettingsGroup>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 48 },
  block: { padding: 14, gap: 12 },
  help: { fontSize: 13.5, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 5,
    paddingRight: 8,
    borderRadius: 18,
    maxWidth: '100%',
  },
  chipText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  remove: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  letter: { alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52 },
  resultText: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '500' },
});
