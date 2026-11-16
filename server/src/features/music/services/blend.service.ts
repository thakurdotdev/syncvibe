import { cache } from '@/utils/redis';
import { areFriends, publicUsers, sharingIds, type PublicUser } from './friends.service';
import { loadProfile, loadSongData, type ListenerProfile } from './listener.service';
import { composeBlend, interleave, type BlendSide } from './personal.scoring';
import { engagement, pickSeeds } from './recommendation.scoring';
import { relatedTo } from './recommendation.service';

type SongData = Record<string, unknown>;

const BLEND_SONGS = 30;
const SEEDS_PER_SIDE = 5;
const FAVOURITES_PER_SIDE = 6;
const BLEND_CACHE_SECONDS = 6 * 60 * 60;

export class BlendError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export interface Blend {
  partner: PublicUser;
  songs: SongData[];
  /** Song id to whose taste it came from. */
  sides: Record<string, BlendSide>;
}

/** Each side's picks: their best-loved songs in turn with new songs like them. */
const sidePicks = async (
  profile: ListenerProfile,
  other: ListenerProfile
): Promise<Array<{ songId: string }>> => {
  const now = new Date();
  const seeds = pickSeeds(profile.listens, now).slice(0, SEEDS_PER_SIDE);
  // New to both of them, so neither gets the other's songs passed off as new.
  const combined = { ...profile, known: new Set([...profile.known, ...other.known]) };
  const fresh = (await relatedTo(seeds, combined)).filter(
    (item) => !other.dislikes.songIds.has(item.songId)
  );
  const favourites = [...profile.listens]
    .filter((listen) => !other.dislikes.songIds.has(listen.songId))
    .sort((a, b) => engagement(b) - engagement(a))
    .slice(0, FAVOURITES_PER_SIDE);
  // Two new songs, then one they love, so each side sounds like them from the start.
  return interleave(
    fresh.map((item) => ({ songId: item.songId })),
    favourites.map((listen) => ({ songId: listen.songId })),
    2,
    BLEND_SONGS
  );
};

/** Songs both people play, the ones both like most first. */
const sharedSongs = (a: ListenerProfile, b: ListenerProfile): Array<{ songId: string }> => {
  const theirs = new Map(b.listens.map((listen) => [listen.songId, engagement(listen)]));
  return a.listens
    .filter((listen) => theirs.has(listen.songId))
    .map((listen) => ({
      songId: listen.songId,
      score: Math.min(engagement(listen), theirs.get(listen.songId)!),
    }))
    .sort((x, y) => y.score - x.score);
};

/** A mix of two friends' taste, the same for both of them on the same day. */
export const getBlend = async (userId: number, partnerId: number): Promise<Blend> => {
  if (!Number.isInteger(partnerId) || partnerId === userId) {
    throw new BlendError('Choose someone else to blend with', 400);
  }
  const partner = (await publicUsers([partnerId])).get(partnerId);
  if (!partner) throw new BlendError('User not found', 404);
  if (!(await areFriends(userId, partnerId))) {
    throw new BlendError('Blends are for friends: follow each other or chat first', 403);
  }
  const sharing = await sharingIds([userId, partnerId]);
  if (!sharing.has(partnerId)) {
    throw new BlendError(`${partner.name} keeps their listening private`, 403);
  }

  // Keyed by the pair, low id first, so both people see the same blend.
  const [low, high] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
  const key = `blend:v1:${low}:${high}:${new Date().toISOString().slice(0, 10)}`;
  let cached = await cache.get<{
    songIds: string[];
    sides: Record<string, 'low' | 'high' | 'both'>;
  }>(key);

  if (!cached) {
    const [lowProfile, highProfile] = await Promise.all([loadProfile(low), loadProfile(high)]);
    if (lowProfile.listens.length === 0 || highProfile.listens.length === 0) {
      throw new BlendError('You both need to play some music first', 409);
    }
    const [lowPicks, highPicks] = [
      await sidePicks(lowProfile, highProfile),
      await sidePicks(highProfile, lowProfile),
    ];
    const blend = composeBlend(
      sharedSongs(lowProfile, highProfile),
      lowPicks,
      highPicks,
      BLEND_SONGS
    );
    cached = {
      songIds: blend.map((item) => item.songId),
      sides: Object.fromEntries(
        blend.map((item) => [
          item.songId,
          item.side === 'both' ? 'both' : item.side === 'you' ? 'low' : 'high',
        ])
      ),
    };
    await cache.set(key, cached, BLEND_CACHE_SECONDS);
  }

  const mine = userId === low ? 'low' : 'high';
  return {
    partner,
    songs: await loadSongData(cached.songIds),
    sides: Object.fromEntries(
      Object.entries(cached.sides).map(([songId, side]) => [
        songId,
        side === 'both' ? 'both' : side === mine ? 'you' : 'them',
      ])
    ),
  };
};
