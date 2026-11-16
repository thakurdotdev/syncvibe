import { Op } from 'sequelize';
import { Follower, Message, MusicTaste, User } from '@/models/index';
import { findDirectConversationId } from '@/features/chat/services/conversation.service';

/**
 * Friends, for music: people who follow each other, or who have both written in one
 * conversation. Anyone can open a conversation with anyone, so an opened one alone isn't enough.
 */
export const areFriends = async (a: number, b: number): Promise<boolean> => {
  if (a === b) return false;
  const follows = await Follower.count({
    where: {
      [Op.or]: [
        { followerid: a, followid: b },
        { followerid: b, followid: a },
      ],
    },
  });
  if (follows >= 2) return true;

  const conversationId = await findDirectConversationId(a, b);
  if (!conversationId) return false;
  const senders = await Message.count({
    where: { conversationId, senderId: { [Op.in]: [a, b] } },
    distinct: true,
    col: 'senderId',
  });
  return senders >= 2;
};

/** People this user follows who follow them back. */
export const mutualFollowIds = async (userId: number): Promise<number[]> => {
  const following = await Follower.findAll({
    where: { followerid: userId },
    attributes: ['followid'],
    raw: true,
  });
  if (following.length === 0) return [];
  const back = await Follower.findAll({
    where: { followid: userId, followerid: { [Op.in]: following.map((row) => row.followid) } },
    attributes: ['followerid'],
    raw: true,
  });
  return [...new Set(back.map((row) => row.followerid))];
};

/** Of these people, the ones who share what they listen to (everyone does until they turn it off). */
export const sharingIds = async (userIds: number[]): Promise<Set<number>> => {
  if (userIds.length === 0) return new Set();
  const privateRows = await MusicTaste.findAll({
    where: { userId: { [Op.in]: userIds }, shareListening: false },
    attributes: ['userId'],
    raw: true,
  });
  const hidden = new Set(privateRows.map((row) => row.userId));
  return new Set(userIds.filter((id) => !hidden.has(id)));
};

export interface PublicUser {
  userid: number;
  name: string;
  username: string;
  profilepic: string | null;
}

export const publicUsers = async (userIds: number[]): Promise<Map<number, PublicUser>> => {
  if (userIds.length === 0) return new Map();
  const users = await User.findAll({
    where: { userid: { [Op.in]: userIds }, isDeleted: false },
    attributes: ['userid', 'name', 'username', 'profilepic'],
    raw: true,
  });
  return new Map(users.map((user) => [user.userid, user as PublicUser]));
};
