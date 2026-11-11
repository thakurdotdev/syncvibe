import type { Server } from 'socket.io';
import { tellMembersRooms } from './devices';
import { pendingRequestsOf } from './former';
import { touchRoom } from './room-store';
import {
  legacyRoomOf,
  liveSkipVotes,
  musicGroups,
  skipVotesNeeded,
  syncRoomOf,
  type GroupMember,
  type MusicGroup,
} from './state';

/*
 * What devices are told. The room is sent as three parts, each whole and with its own revision:
 * playback (small, changes often), the upcoming queue (large, changes less) and settings. A part
 * always replaces the device's copy, so a missed message can never leave it half-updated; the
 * revisions come back with every clock ping, which is how a device notices it missed one.
 *
 * Every change passes through here, so this is also where a room is marked for saving.
 *
 * App and web versions from before this protocol get the events they already understand, built
 * from the same record.
 */

export type PlaybackKind = 'track' | 'play' | 'pause' | 'seek' | 'stop';
export type Actor = Pick<GroupMember, 'userId' | 'userName'>;

const playbackPart = (group: MusicGroup) => ({
  rev: group.revs.playback,
  item: group.current,
  playing: group.timeline.playing,
  positionMs: group.timeline.positionMs,
  anchorAt: group.timeline.anchorAt,
});

const queuePart = (group: MusicGroup) => ({
  rev: group.revs.queue,
  upcoming: group.upcoming,
});

const skipVotesPart = (group: MusicGroup) => {
  const userIds = liveSkipVotes(group);
  return userIds.length > 0 && group.current
    ? { itemId: group.current.id, userIds, needed: skipVotesNeeded(group) }
    : null;
};

const metaPart = (group: MusicGroup) => ({
  rev: group.revs.meta,
  hostId: group.createdBy,
  coHosts: group.coHosts,
  mutedIds: group.mutedIds,
  skipVotes: skipVotesPart(group),
  rejoinRequests: pendingRequestsOf(group),
  settings: group.settings,
  maxMembers: group.maxMembers,
  features: group.features,
});

/** Everything a device needs to be in the room, in one message. */
export const snapshotOf = (group: MusicGroup) => ({
  groupId: group.id,
  serverTime: Date.now(),
  playback: playbackPart(group),
  queue: queuePart(group),
  meta: metaPart(group),
  members: group.members,
});

export const revsOf = (group: MusicGroup) => ({ ...group.revs });

// --- The shapes older versions expect ---

const legacyQueueState = (group: MusicGroup) => {
  const queue = group.current ? [group.current, ...group.upcoming] : group.upcoming;
  return {
    queue,
    currentQueueIndex: group.current ? 0 : -1,
    currentSongId: group.current?.id ?? null,
    currentItem: group.current,
  };
};

const legacyPlaybackState = (group: MusicGroup) => ({
  isPlaying: group.timeline.playing,
  currentTime: group.timeline.positionMs / 1000,
  currentTrack: group.current?.song ?? null,
  lastUpdate: group.timeline.anchorAt,
  serverTime: Date.now(),
});

/** Reply to an older version asking where the room is. */
export const legacySyncState = (group: MusicGroup) => ({
  playbackState: legacyPlaybackState(group),
  ...legacyQueueState(group),
  settings: group.settings,
});

/** The room as sent on creating or joining it. Never the record itself, which holds timers. */
export const publicGroupOf = (group: MusicGroup) => ({
  id: group.id,
  name: group.name,
  createdBy: group.createdBy,
  createdAt: group.createdAt,
  members: group.members,
  settings: group.settings,
  maxMembers: group.maxMembers,
  features: group.features,
  qrCode: group.qrCode,
  playbackState: legacyPlaybackState(group),
  ...legacyQueueState(group),
});

/** Sent to a device that has just joined, whichever version it is. */
export const joinPayloadOf = (group: MusicGroup) => ({
  group: publicGroupOf(group),
  members: group.members,
  playbackState: legacyPlaybackState(group),
  ...legacyQueueState(group),
  sync: snapshotOf(group),
});

// --- Changes ---

export const broadcastPlayback = (
  io: Server,
  group: MusicGroup,
  kind: PlaybackKind,
  by?: Actor
): void => {
  touchRoom(group, 'core');
  const now = Date.now();
  io.to(syncRoomOf(group.id)).emit('room:playback', {
    groupId: group.id,
    kind,
    serverTime: now,
    ...(by ? { by } : {}),
    ...playbackPart(group),
  });
  if (kind !== 'seek') tellMembersRooms(io, group);

  const legacy = io.to(legacyRoomOf(group.id));
  const { timeline, current } = group;

  if (kind === 'stop') {
    legacy.emit('queue-ended');
    return;
  }
  if (kind === 'track') {
    if (!current) return;
    legacy.emit('music-update', {
      song: current.song,
      currentTime: timeline.positionMs / 1000,
      queueItem: current,
      autoPlay: true,
      scheduledPlayTime: timeline.anchorAt,
      serverTime: now,
    });
    return;
  }

  const playbackUpdate = () =>
    io.to(legacyRoomOf(group.id)).emit('playback-update', {
      isPlaying: timeline.playing,
      currentTime: timeline.positionMs / 1000,
      serverTime: timeline.anchorAt,
      ...(kind === 'seek' ? { isSeeking: true } : {}),
    });

  // Older versions start the moment they hear, so they hear at the moment everyone else starts.
  const wait = timeline.anchorAt - now;
  if (wait <= 0) {
    playbackUpdate();
    return;
  }
  const rev = group.revs.playback;
  setTimeout(() => {
    if (musicGroups.get(group.id) === group && group.revs.playback === rev) playbackUpdate();
  }, wait).unref();
};

export const broadcastQueue = (
  io: Server,
  group: MusicGroup,
  action: string,
  extra: Record<string, unknown> = {},
  by?: Actor
): void => {
  touchRoom(group, 'queue');
  io.to(syncRoomOf(group.id)).emit('room:queue', {
    groupId: group.id,
    action,
    ...(by ? { by } : {}),
    ...extra,
    ...queuePart(group),
  });
  io.to(legacyRoomOf(group.id)).emit('queue-updated', {
    ...legacyQueueState(group),
    action,
    ...extra,
  });
};

export const broadcastMeta = (io: Server, group: MusicGroup): void => {
  touchRoom(group, 'core');
  io.to(syncRoomOf(group.id)).emit('room:meta', { groupId: group.id, ...metaPart(group) });
  io.to(legacyRoomOf(group.id)).emit('group-settings-updated', { settings: group.settings });
};
