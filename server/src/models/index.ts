/**
 * Models barrel export + all association registration.
 *
 * Import this file (instead of individual models) anywhere you need models,
 * so that associations are guaranteed to be set up before any query runs.
 */

import { DataTypes } from 'sequelize';
import sequelize from '@/utils/sequelize';

// Auth
import User from './auth/user.model';
import Follower from './auth/follower.model';
import LoginLog from './auth/login-log.model';
import OTP from './auth/otp.model';
import Authenticator from './auth/passkey.model';

// Chat
import Chat from './chat/chat.model';
import ChatMessage from './chat/chat-message.model';

// Music
import Song from './music/song.model';
import HistorySong from './music/history-song.model';
import PlaylistSong from './music/playlist-song.model';
import Playlist from './music/playlist.model';
import GroupInvite from './music/group-invite.model';
import GroupSessionHistory from './music/group-session-history.model';

// Post
import Post from './post/post.model';
import Comment from './post/comment.model';
import LikeDislike from './post/like-dislike.model';

// Payment
import Plan from './payment/plan.model';
import Payment from './payment/payment.model';
import UserEntitlement from './payment/user-entitlement.model';

// Story
import Story from './story/story.model';
import StoryMusic from './story/story-music.model';

// App Update
import AppUpdate from './app-update.model';

// ─── ChatUser junction table ────────────────────────────────────────────────
const ChatUser = sequelize.define('ChatUser', {
  chatid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  userid: {
    type: DataTypes.INTEGER,
    references: { model: User, key: 'userid' },
  },
});

// ─── User ↔ Chat (many-to-many) ────────────────────────────────────────────
User.belongsToMany(Chat, { through: ChatUser, foreignKey: 'userid' });
Chat.belongsToMany(User, { through: ChatUser, foreignKey: 'chatid' });

// ─── User ↔ Comment ────────────────────────────────────────────────────────
User.hasMany(Comment, { foreignKey: 'createdby', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'createdby', as: 'user' });

// ─── User ↔ Post ───────────────────────────────────────────────────────────
User.hasMany(Post, { foreignKey: 'createdby', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'createdby', as: 'user' });

// ─── User ↔ Story ──────────────────────────────────────────────────────────
User.hasMany(Story, { foreignKey: 'createdby', as: 'stories' });
Story.belongsTo(User, { foreignKey: 'createdby', as: 'user' });

// ─── User ↔ Authenticator ──────────────────────────────────────────────────
User.hasMany(Authenticator, { foreignKey: 'userid', as: 'authenticators' });
Authenticator.belongsTo(User, { foreignKey: 'userid', as: 'user' });

// ─── User ↔ Follower (self-referential many-to-many) ───────────────────────
User.belongsToMany(User, {
  through: Follower,
  as: 'followingUsers',
  foreignKey: 'followerid',
  otherKey: 'followid',
});
User.belongsToMany(User, {
  through: Follower,
  as: 'followerUsers',
  foreignKey: 'followid',
  otherKey: 'followerid',
});
User.hasMany(Follower, { foreignKey: 'followerid', as: 'followersList' });
User.hasMany(Follower, { foreignKey: 'followid', as: 'followingList' });
Follower.belongsTo(User, { foreignKey: 'followerid', as: 'followerDetail' });
Follower.belongsTo(User, { foreignKey: 'followid', as: 'followingDetail' });

// ─── User ↔ LoginLog ──────────────────────────────────────────────────────
User.hasMany(LoginLog, { foreignKey: 'userid', as: 'loginLogs' });
LoginLog.belongsTo(User, { foreignKey: 'userid', as: 'user' });

// ─── Song ↔ HistorySong ───────────────────────────────────────────────────
Song.hasMany(HistorySong, { foreignKey: 'songRefId', as: 'historyEntries' });
HistorySong.belongsTo(Song, { foreignKey: 'songRefId', as: 'song' });

// ─── Song ↔ PlaylistSong ──────────────────────────────────────────────────
Song.hasMany(PlaylistSong, { foreignKey: 'songRefId', as: 'playlistEntries' });
PlaylistSong.belongsTo(Song, { foreignKey: 'songRefId', as: 'song' });

// ─── Song ↔ GroupSessionHistory ────────────────────────────────────────────
Song.hasMany(GroupSessionHistory, { foreignKey: 'songRefId', as: 'groupSessionEntries' });
GroupSessionHistory.belongsTo(Song, { foreignKey: 'songRefId', as: 'song' });
GroupSessionHistory.belongsTo(User, {
  foreignKey: 'addedByUserId',
  targetKey: 'userid',
  as: 'addedBy',
});

// ─── User ↔ Payment ───────────────────────────────────────────────────────
User.hasMany(Payment, { foreignKey: 'userid', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userid', as: 'user' });

// ─── User ↔ UserEntitlement ───────────────────────────────────────────────
User.hasMany(UserEntitlement, { foreignKey: 'userid', as: 'entitlements' });
UserEntitlement.belongsTo(User, { foreignKey: 'userid', as: 'user' });

// ─── Plan ↔ UserEntitlement ───────────────────────────────────────────────
Plan.hasMany(UserEntitlement, { foreignKey: 'planid', as: 'entitlements' });
UserEntitlement.belongsTo(Plan, { foreignKey: 'planid', as: 'plan' });

// ─── Payment ↔ UserEntitlement ────────────────────────────────────────────
Payment.hasOne(UserEntitlement, { foreignKey: 'paymentid', as: 'entitlement' });
UserEntitlement.belongsTo(Payment, { foreignKey: 'paymentid', as: 'payment' });

// ─── Re-exports ────────────────────────────────────────────────────────────
export {
  User,
  Follower,
  LoginLog,
  OTP,
  Authenticator,
  Chat,
  ChatMessage,
  ChatUser,
  Song,
  HistorySong,
  PlaylistSong,
  Playlist,
  GroupInvite,
  GroupSessionHistory,
  Post,
  Comment,
  LikeDislike,
  Plan,
  Payment,
  UserEntitlement,
  Story,
  StoryMusic,
  AppUpdate,
};

export type { UserAttributes } from './auth/user.model';
