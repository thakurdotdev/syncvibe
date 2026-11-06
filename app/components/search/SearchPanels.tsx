import { SONG_LIST_WINDOW } from '@/lib/lists';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { SongCard } from '@/components/music/MusicCards';
import SearchHistory from '@/components/music/SearchHistory';
import PressableScale from '@/components/ui/PressableScale';
import { useChat } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import {
  MIN_REMOTE_QUERY,
  useCatalogPlaylistSearch,
  useHistorySearch,
  useOwnPlaylists,
  usePeopleSearch,
  useSongSearch,
  type PersonResult,
  type PlaylistResult,
} from '@/queries/useSearch';
import { Song } from '@/types/song';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { convertToHttps } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import { SearchHistoryItem, searchHistoryManager } from '@/utils/searchHistory';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const LIST_PROPS = {
  showsVerticalScrollIndicator: false,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  windowSize: 8,
} as const;

const songKey = (song: Song) => String(song.id);

/** The one centred state every panel uses: a hint, an empty result, or an error with a retry. */
const Message = memo(function Message({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <Feather name={icon} size={26} color={colors.mutedForeground} />
      <Text style={[styles.messageTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.messageSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
      {action && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole='button'
          style={[styles.messageAction, { borderColor: colors.border }]}
        >
          <Text style={[styles.messageActionText, { color: colors.foreground }]}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
});

const Loading = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
};

const goToLogin = () => router.push('/login');

export const SongsPanel = memo(function SongsPanel({
  text,
  query,
  onPickQuery,
}: {
  text: string;
  query: string;
  onPickQuery: (query: string) => void;
}) {
  const { colors } = useTheme();
  const { data: songs = [], isPending, isFetching, isError, refetch } = useSongSearch(query);
  const [suggestions, setSuggestions] = useState<SearchHistoryItem[]>([]);

  // One or two letters rarely find the right song, so offer your own past searches first.
  const typed = text.trim();
  const short = typed.length > 0 && typed.length < 3;
  useEffect(() => {
    if (!short) {
      setSuggestions([]);
      return;
    }
    let current = true;
    searchHistoryManager
      .getHistory(typed)
      .then((found) => current && setSuggestions(found.slice(0, 5)))
      .catch(() => current && setSuggestions([]));
    return () => {
      current = false;
    };
  }, [short, typed]);

  const renderSong = useCallback(
    ({ item }: { item: Song }) => (
      <SongCard
        song={item}
        onPress={async () => {
          await searchHistoryManager.addToHistoryOnSongClick(query);
        }}
      />
    ),
    [query]
  );

  if (!typed) return <SearchHistory onHistoryItemPress={onPickQuery} />;

  if (suggestions.length > 0) {
    return (
      <View style={styles.list}>
        {suggestions.map((item) => (
          <PressableScale
            key={item.id}
            onPress={() => onPickQuery(item.query)}
            scaleTo={ROW_PRESS_SCALE}
            accessibilityRole='button'
            style={styles.suggestion}
          >
            <Feather name='clock' size={17} color={colors.mutedForeground} />
            <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
              {item.query}
            </Text>
          </PressableScale>
        ))}
      </View>
    );
  }

  if (!query) return null;
  if (isError) {
    return (
      <Message
        icon='wifi-off'
        title="Couldn't search songs"
        subtitle='Check your connection and try again.'
        action='Try again'
        onAction={refetch}
      />
    );
  }
  if (isPending) return <Loading />;
  if (!isFetching && songs.length === 0) {
    return (
      <Message
        icon='search'
        title={`No songs for "${query}"`}
        subtitle='Try different keywords or check the spelling.'
      />
    );
  }

  return (
    <FlatList
      {...LIST_PROPS}
      data={songs}
      renderItem={renderSong}
      {...SONG_LIST_WINDOW}
      keyExtractor={songKey}
      contentContainerStyle={styles.list}
    />
  );
});

const renderSongCard = ({ item }: { item: Song }) => <SongCard song={item} />;

export const HistoryPanel = memo(function HistoryPanel({ query }: { query: string }) {
  const { colors } = useTheme();
  const { user } = useUser();
  const { data, isPending, isFetching, isError, refetch } = useHistorySearch(query);
  const songs = data?.songs ?? [];
  const hasMore = (data?.count ?? 0) > songs.length;

  if (!user?.userid) {
    return (
      <Message
        icon='clock'
        title='Search what you have played'
        subtitle='Log in to keep your listening history.'
        action='Log in'
        onAction={goToLogin}
      />
    );
  }
  if (isError) {
    return (
      <Message
        icon='wifi-off'
        title="Couldn't load your history"
        action='Try again'
        onAction={refetch}
      />
    );
  }
  if (isPending) return <Loading />;
  if (!isFetching && songs.length === 0) {
    return query ? (
      <Message icon='search' title={`Nothing you've played matches "${query}"`} />
    ) : (
      <Message
        icon='clock'
        title='Nothing played yet'
        subtitle='Songs you listen to will show up here.'
      />
    );
  }

  return (
    <FlatList
      {...LIST_PROPS}
      data={songs}
      renderItem={renderSongCard}
      {...SONG_LIST_WINDOW}
      keyExtractor={songKey}
      contentContainerStyle={styles.list}
      ListFooterComponent={
        hasMore ? (
          <PressableScale
            onPress={() => router.push('/song-history')}
            scaleTo={ROW_PRESS_SCALE}
            accessibilityRole='button'
            style={styles.seeAll}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See full history</Text>
            <Ionicons name='chevron-forward' size={16} color={colors.primary} />
          </PressableScale>
        ) : null
      }
    />
  );
});

const firstLink = (image: unknown): string => {
  if (typeof image === 'string') return convertToHttps(image);
  if (Array.isArray(image)) {
    const link = image[1]?.link || image[0]?.link;
    return typeof link === 'string' ? convertToHttps(link) : '';
  }
  return '';
};

const PlaylistRow = memo(function PlaylistRow({
  playlist,
  own,
}: {
  playlist: PlaylistResult;
  own: boolean;
}) {
  const { colors } = useTheme();
  const art = firstLink(own ? playlist.previewSongs?.[0]?.image : playlist.image);
  const count = Number(playlist.songCount) || 0;
  const meta = own ? `${count} ${count === 1 ? 'song' : 'songs'}` : playlist.subtitle;

  return (
    <PressableScale
      onPress={() =>
        router.push({
          pathname: own ? '/user-playlist' : '/playlists',
          params: { id: String(playlist.id) },
        })
      }
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${playlist.name}${meta ? `, ${meta}` : ''}`}
      style={styles.row}
    >
      {art ? (
        <Image
          source={{ uri: art }}
          style={[styles.art, { backgroundColor: colors.muted }]}
          fadeDuration={0}
        />
      ) : (
        <View style={[styles.art, styles.artEmpty, { backgroundColor: colors.muted }]}>
          <Ionicons name='musical-notes' size={18} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Ionicons name='chevron-forward' size={18} color={colors.mutedForeground} />
    </PressableScale>
  );
});

type PlaylistSection = { title: string; own: boolean; data: PlaylistResult[] };

const playlistKey = (item: PlaylistResult, index: number) => `${item.id}-${index}`;

export const PlaylistsPanel = memo(function PlaylistsPanel({ query }: { query: string }) {
  const { colors } = useTheme();
  const { data: own = [], isLoading: loadingOwn } = useOwnPlaylists();
  const {
    data: catalog = [],
    isLoading: loadingCatalog,
    isFetching: fetchingCatalog,
    isError,
    refetch,
  } = useCatalogPlaylistSearch(query);
  const searchesCatalog = query.length >= MIN_REMOTE_QUERY;

  const sections = useMemo(() => {
    const needle = query.toLowerCase();
    const mine = needle ? own.filter((p) => p.name?.toLowerCase().includes(needle)) : own;
    const out: PlaylistSection[] = [];
    if (mine.length) out.push({ title: 'Your playlists', own: true, data: mine });
    if (searchesCatalog && catalog.length) {
      out.push({ title: 'From SyncVibe', own: false, data: catalog });
    }
    return out;
  }, [catalog, own, query, searchesCatalog]);

  const renderPlaylist = useCallback(
    ({ item, section }: { item: PlaylistResult; section: PlaylistSection }) => (
      <PlaylistRow playlist={item} own={section.own} />
    ),
    []
  );
  const renderHeader = useCallback(
    ({ section }: { section: PlaylistSection }) => (
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
    ),
    [colors.mutedForeground]
  );

  if (sections.length === 0) {
    if (loadingOwn || loadingCatalog || fetchingCatalog) return <Loading />;
    if (isError) {
      return (
        <Message
          icon='wifi-off'
          title="Couldn't search playlists"
          action='Try again'
          onAction={refetch}
        />
      );
    }
    return query ? (
      <Message icon='search' title={`No playlists for "${query}"`} />
    ) : (
      <Message
        icon='list'
        title='Find a playlist'
        subtitle='Search public playlists and the ones you made.'
      />
    );
  }

  return (
    <SectionList
      {...LIST_PROPS}
      sections={sections}
      renderItem={renderPlaylist}
      renderSectionHeader={renderHeader}
      keyExtractor={playlistKey}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
    />
  );
});

export const PeoplePanel = memo(function PeoplePanel({ query }: { query: string }) {
  const { colors } = useTheme();
  const { user } = useUser();
  const api = useApi();
  const { setCurrentChat, socket, getAllExistingChats } = useChat();
  const { data = [], isPending, isFetching, isError, refetch } = usePeopleSearch(query);
  const [openingId, setOpeningId] = useState<PersonResult['userid'] | null>(null);

  const people = useMemo(
    () => data.filter((person) => String(person.userid) !== String(user?.userid)),
    [data, user?.userid]
  );

  const openChat = useCallback(
    async (person: PersonResult) => {
      setOpeningId(person.userid);
      try {
        const response = await api.post('/api/create/chat', { recieverid: person.userid });
        setCurrentChat(response.data.chat);
        socket?.emit('join-room', response.data.chat.chatid);
        await getAllExistingChats();
        router.push('/message');
      } catch {
        toast(`Couldn't open a chat with ${person.name}`);
      } finally {
        setOpeningId(null);
      }
    },
    [api, getAllExistingChats, setCurrentChat, socket]
  );

  const renderPerson = useCallback(
    ({ item }: { item: PersonResult }) => (
      <PressableScale
        onPress={() => openChat(item)}
        disabled={openingId !== null}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`Message ${item.name}`}
        style={styles.row}
      >
        <Image
          source={{ uri: getProfileCloudinaryUrl(item.profilepic) }}
          style={[styles.avatar, { backgroundColor: colors.muted }]}
          fadeDuration={0}
        />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.username ? (
            <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        {openingId === item.userid ? (
          <ActivityIndicator size='small' color={colors.primary} />
        ) : (
          <Ionicons name='chatbubble-outline' size={19} color={colors.mutedForeground} />
        )}
      </PressableScale>
    ),
    [colors, openChat, openingId]
  );

  if (!user?.userid) {
    return (
      <Message
        icon='users'
        title='Find people on SyncVibe'
        subtitle='Log in to search for friends and message them.'
        action='Log in'
        onAction={goToLogin}
      />
    );
  }
  if (query.length < MIN_REMOTE_QUERY) {
    return <Message icon='users' title='Find people' subtitle='Search by name to message them.' />;
  }
  if (isError) {
    return (
      <Message
        icon='wifi-off'
        title="Couldn't search people"
        action='Try again'
        onAction={refetch}
      />
    );
  }
  if (isPending) return <Loading />;
  if (!isFetching && people.length === 0) {
    return <Message icon='search' title={`No one found for "${query}"`} />;
  }

  return (
    <FlatList
      {...LIST_PROPS}
      data={people}
      renderItem={renderPerson}
      keyExtractor={(item) => String(item.userid)}
      extraData={openingId}
      contentContainerStyle={styles.list}
    />
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 32 },
  loading: { paddingTop: 72, alignItems: 'center' },

  message: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 40, gap: 6 },
  messageTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  messageSubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  messageAction: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  messageActionText: { fontSize: 14, fontWeight: '600' },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  suggestionText: { flex: 1, fontSize: 15 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  art: { width: 46, height: 46, borderRadius: 8 },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 12.5, marginTop: 2 },

  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    marginTop: 4,
  },
  seeAllText: { fontSize: 14, fontWeight: '600' },
});
