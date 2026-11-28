import SwipeableModal from '@/components/SwipeableModal';
import { CachedImage } from '@/components/ui/CachedImage';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { usePlaybackState } from '@/stores/playerStore';
import type { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { songArtists, songCoverOf } from '@/lib/chatSongs';

const SEARCH_DELAY_MS = 350;

interface SongPickerSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onPick: (song: Song) => void;
}

const SongRow = ({ song, label, onPick }: { song: Song; label?: string; onPick: () => void }) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPick}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`Send ${song.name}`}
      style={styles.row}
    >
      <View style={[styles.cover, { backgroundColor: colors.raised }]}>
        <CachedImage source={{ uri: songCoverOf(song) }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.rowText}>
        {label ? (
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        ) : null}
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={[styles.artists, { color: colors.mutedForeground }]} numberOfLines={1}>
          {songArtists(song)}
        </Text>
      </View>
      <Feather name='send' size={17} color={colors.mutedForeground} />
    </PressableScale>
  );
};

/** Finds a song to share in the conversation; the one playing is offered first. */
const SongPickerSheet: React.FC<SongPickerSheetProps> = ({ isVisible, onClose, onPick }) => {
  const { colors } = useTheme();
  const { currentSong } = usePlaybackState();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  // Results arrive a moment after typing stops; the spinner shows from the first key.
  const changeQuery = (text: string) => {
    setQuery(text);
    setLoading(text.trim().length > 0);
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      searchSongs(q, abort.signal)
        .then((songs) => setResults(songs.filter((song) => song?.id)))
        .catch(() => !abort.signal.aborted && setResults([]))
        .finally(() => !abort.signal.aborted && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const close = () => {
    changeQuery('');
    onClose();
  };
  const pick = (song: Song) => {
    changeQuery('');
    onPick(song);
  };

  const searching = query.trim().length > 0;

  return (
    <SwipeableModal
      isVisible={isVisible}
      onClose={close}
      maxHeight={Dimensions.get('window').height * 0.78}
      style={{ height: Dimensions.get('window').height * 0.78 }}
    >
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.foreground }]}>Share a song</Text>
        <View style={[styles.search, { backgroundColor: colors.raised }]}>
          <Feather name='search' size={15} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={changeQuery}
            placeholder='Search songs'
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            returnKeyType='search'
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {loading ? <ActivityIndicator size='small' color={colors.mutedForeground} /> : null}
        </View>

        <FlatList
          data={searching ? results : []}
          keyExtractor={(song) => String(song.id)}
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            !searching && currentSong?.id ? (
              <SongRow song={currentSong} label='Playing now' onPick={() => pick(currentSong)} />
            ) : null
          }
          ListEmptyComponent={
            searching && !loading ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No songs found for "{query.trim()}"
              </Text>
            ) : !searching && !currentSong?.id ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Search for a song to send.
              </Text>
            ) : null
          }
          renderItem={({ item }) => <SongRow song={item} onPick={() => pick(item)} />}
        />
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  title: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cover: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden' },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  name: { fontSize: 15, fontWeight: '600' },
  artists: { fontSize: 13, marginTop: 1 },
  emptyText: { textAlign: 'center', fontSize: 14, marginTop: 40, paddingHorizontal: 24 },
});

export default SongPickerSheet;
