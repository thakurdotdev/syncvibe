import { nowPlayingOf } from '@/socket/player/hub';
import { getUserGroups, musicGroups } from '@/socket/group-music/state';
import { mutualFollowIds, publicUsers, sharingIds, type PublicUser } from './friends.service';

type SongData = Record<string, unknown>;

export interface FriendActivity {
  user: PublicUser;
  song: SongData | null;
  /** The room they're in, which friends can join. */
  room: { id: string; name: string; members: number } | null;
}

/**
 * What the people you follow, and who follow you back, are playing now: on their own player or
 * in a room. Read from memory, so it costs nothing and is only ever current. People who turned
 * off sharing don't appear.
 */
export const friendsListeningNow = async (userId: number): Promise<FriendActivity[]> => {
  const friends = await sharingIds(await mutualFollowIds(userId));
  const active = [...friends].flatMap(
    (friendId): Array<Omit<FriendActivity, 'user'> & { id: number }> => {
      const roomId = [...getUserGroups(friendId)].find((id) =>
        musicGroups.get(id)?.members.some((member) => String(member.userId) === String(friendId))
      );
      const group = roomId ? musicGroups.get(roomId) : undefined;
      if (group) {
        return [
          {
            id: friendId,
            song: group.current?.song ?? null,
            room: { id: group.id, name: group.name, members: group.members.length },
          },
        ];
      }
      const song = nowPlayingOf(String(friendId));
      return song ? [{ id: friendId, song, room: null }] : [];
    }
  );
  if (active.length === 0) return [];

  const users = await publicUsers(active.map((item) => item.id));
  return active.flatMap(({ id, ...activity }) => {
    const user = users.get(id);
    return user ? [{ user, ...activity }] : [];
  });
};
