import { Op, QueryTypes } from 'sequelize';
import { HistorySong, Song, SongLike } from '@/models/index';
import sequelize from '@/utils/sequelize';
import { getDislikes, type Dislikes } from './dislike.service';
import type { Listen } from './recommendation.scoring';
import { getTaste, type Taste } from './taste.service';

type SongData = Record<string, unknown>;

/**
 * `artistNames` often starts with a composer or an actor, so the singer is read from the song
 * itself. Selected as a column because a long history shouldn't load every song's full data.
 */
export const SINGER = [
  sequelize.literal(`"songData"#>>'{artist_map,primary_artists,0,name}'`),
  'singer',
] as const;
export const SINGER_ID = [
  sequelize.literal(`"songData"#>>'{artist_map,primary_artists,0,id}'`),
  'singerId',
] as const;

type SongRow = Song & { singer: string | null; singerId: string | null };

export const artistOf = (song: { singer: string | null; artistNames: string | null }): string =>
  song.singer || (song.artistNames || '').split(',')[0]!.trim();

export interface ProfileListen extends Listen {
  artistId: string | null;
}

/** Everything known about one listener's taste, loaded together. */
export interface ListenerProfile {
  userId: number;
  listens: ProfileListen[];
  dislikes: Dislikes;
  taste: Taste;
  /** Every song played, liked or disliked: none of them is "new" to this listener. */
  known: Set<string>;
}

const loadListens = async (userId: number): Promise<ProfileListen[]> => {
  const [history, likes] = await Promise.all([
    HistorySong.findAll({
      where: { userId },
      attributes: ['songRefId', 'playedCount', 'completionRate', 'skipCount', 'lastPlayedAt'],
      raw: true,
    }),
    SongLike.findAll({ where: { userId }, attributes: ['songRefId', 'createdAt'], raw: true }),
  ]);
  const likedAt = new Map(likes.map((like) => [like.songRefId, like.createdAt]));
  const refs = [...new Set([...history.map((row) => row.songRefId), ...likedAt.keys()])];
  if (refs.length === 0) return [];

  const songs = (await Song.findAll({
    where: { id: { [Op.in]: refs } },
    attributes: ['id', 'songId', 'name', 'artistNames', 'language', [...SINGER], [...SINGER_ID]],
    raw: true,
  })) as unknown as SongRow[];
  const songsByRef = new Map(songs.map((song) => [song.id, song]));
  const playedRefs = new Set(history.map((row) => row.songRefId));

  const toListen = (
    song: SongRow,
    row: Pick<Listen, 'playedCount' | 'completionRate' | 'skipCount' | 'lastPlayedAt'>
  ): ProfileListen => ({
    songId: song.songId,
    name: song.name || '',
    artist: artistOf(song),
    artistId: song.singerId,
    language: song.language || undefined,
    liked: likedAt.has(song.id),
    ...row,
  });

  return [
    ...history.flatMap((row) => {
      const song = songsByRef.get(row.songRefId);
      if (!song) return [];
      return toListen(song, {
        playedCount: row.playedCount || 1,
        completionRate: row.completionRate || 0,
        skipCount: row.skipCount || 0,
        lastPlayedAt: row.lastPlayedAt,
      });
    }),
    // Liked but never played here, e.g. liked from search on another device before history.
    ...[...likedAt.entries()].flatMap(([ref, createdAt]) => {
      const song = songsByRef.get(ref);
      if (!song || playedRefs.has(ref)) return [];
      return toListen(song, {
        playedCount: 0,
        completionRate: 0,
        skipCount: 0,
        lastPlayedAt: createdAt,
      });
    }),
  ];
};

export const loadProfile = async (userId: number): Promise<ListenerProfile> => {
  const [allListens, dislikes, taste] = await Promise.all([
    loadListens(userId),
    getDislikes(userId),
    getTaste(userId),
  ]);
  return {
    userId,
    // A disliked song can't lead to similar songs or come back as a favourite.
    listens: allListens.filter((listen) => !dislikes.songIds.has(listen.songId)),
    dislikes,
    taste,
    known: new Set([...allListens.map((listen) => listen.songId), ...dislikes.songIds]),
  };
};

/**
 * The languages to recommend in: the ones chosen, else the two this listener plays most, else
 * the catalog's two biggest.
 */
export const languagesOf = (profile: ListenerProfile): string[] => {
  if (profile.taste.languages.length > 0) return profile.taste.languages;
  const counts = new Map<string, number>();
  for (const listen of profile.listens) {
    if (!listen.language || listen.language === 'unknown') continue;
    counts.set(listen.language, (counts.get(listen.language) ?? 0) + 1);
  }
  const played = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([language]) => language);
  return played.length > 0 ? played : ['hindi', 'english'];
};

/** The best-known songs of the artists someone picked, to start from before they've played any. */
export const songsOfArtists = async (
  artists: Array<{ id: string; name: string }>,
  perArtist = 3
): Promise<string[]> => {
  if (artists.length === 0) return [];
  const rows = await sequelize.query<{ songId: string }>(
    `
    SELECT "songId" FROM (
      SELECT s."songId", ROW_NUMBER() OVER (
        PARTITION BY a.id
        ORDER BY CASE WHEN s."songData"->>'play_count' ~ '^[0-9]+$'
          THEN (s."songData"->>'play_count')::bigint ELSE 0 END DESC
      ) AS rank
      FROM UNNEST(ARRAY[:ids]::text[], ARRAY[:names]::text[]) AS a(id, name)
      -- The name narrows it through the trigram index; the id makes sure it's that artist.
      JOIN songs s ON s."artistNames" ILIKE '%' || a.name || '%'
        AND s."songData"->'artist_map'->'primary_artists'
          @> jsonb_build_array(jsonb_build_object('id', a.id))
    ) ranked
    WHERE rank <= :perArtist
    `,
    {
      replacements: {
        ids: artists.map((artist) => artist.id),
        names: artists.map((artist) => artist.name.replace(/[\\%_]/g, '\\$&')),
        perArtist,
      },
      type: QueryTypes.SELECT,
    }
  );
  return rows.map((row) => row.songId);
};

/** Full songs in the order asked for; ids the catalog doesn't hold are left out. */
export const loadSongData = async (songIds: string[]): Promise<SongData[]> => {
  if (songIds.length === 0) return [];
  const songs = await Song.findAll({
    where: { songId: { [Op.in]: songIds } },
    attributes: ['songId', 'songData'],
    raw: true,
  });
  const byId = new Map(songs.map((song) => [song.songId, song.songData as SongData]));
  return songIds.flatMap((id) => {
    const data = byId.get(id);
    return data ? [data] : [];
  });
};

export interface SongFacts {
  songId: string;
  name: string;
  artist: string;
  language: string;
  album: string;
}

/** Name, singer, language and album of each song, without loading the songs' full data. */
export const loadSongFacts = async (songIds: string[]): Promise<Map<string, SongFacts>> => {
  if (songIds.length === 0) return new Map();
  const songs = (await Song.findAll({
    where: { songId: { [Op.in]: songIds } },
    attributes: ['songId', 'name', 'artistNames', 'language', 'albumName', [...SINGER]],
    raw: true,
  })) as unknown as SongRow[];
  return new Map(
    songs.map((song) => [
      song.songId,
      {
        songId: song.songId,
        name: song.name || '',
        artist: artistOf(song),
        language: song.language || '',
        album: song.albumName || '',
      },
    ])
  );
};
