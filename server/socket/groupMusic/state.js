const { v4: uuidv4 } = require("uuid");

const musicGroups = new Map();
const userGroups = new Map();
const TIME_TO_REJOIN = 10000;

const generateGroupId = () => {
  const id = Math.floor(100000 + Math.random() * 900000).toString();
  return `syncvibe_${id}`;
};

const generateQueueItemId = () => uuidv4();
const generateMessageId = () => uuidv4();

const emitActivityMessage = (io, groupId, activityType, data) => {
  const group = musicGroups.get(groupId);
  if (!group?.features?.realtimeChat) return;

  const activityMessages = {
    "song-added": `${data.userName} added "${data.songName}" to the queue`,
    "song-playing": `Now playing "${data.songName}"${data.addedBy ? ` (added by ${data.addedBy})` : ""}`,
    "song-skipped": `${data.userName || "Someone"} skipped to the next song`,
    "queue-ended": `Queue ended — add more songs!`,
    "user-joined": `${data.userName} joined the session`,
    "user-left": `${data.userName} left the session`,
  };

  const message = activityMessages[activityType];
  if (!message) return;

  io.to(`music-group-${groupId}`).emit("new-message", {
    id: generateMessageId(),
    groupId,
    type: "activity",
    activityType,
    message,
    timestamp: Date.now(),
  });
};

const getGroup = (groupId) => musicGroups.get(groupId);

const getScheduledDelay = (group) => {
  if (!group || group.memberRTT.size === 0) return 1500;
  let maxRTT = 0;
  for (const rtt of group.memberRTT.values()) {
    if (rtt > maxRTT) maxRTT = rtt;
  }
  return Math.max(800, Math.min(2500, maxRTT * 2 + 300));
};

const trackUserGroup = (userId, groupId) => {
  if (!userGroups.has(userId)) {
    userGroups.set(userId, new Set());
  }
  userGroups.get(userId).add(groupId);
};

const untrackUserGroup = (userId, groupId) => {
  const groups = userGroups.get(userId);
  if (groups) {
    groups.delete(groupId);
    if (groups.size === 0) {
      userGroups.delete(userId);
    }
  }
};

const getUserGroups = (userId) => {
  return userGroups.get(userId) || new Set();
};

const createGroupState = (data) => ({
  id: data.id,
  name: data.name,
  createdBy: data.createdBy,
  createdAt: Date.now(),
  members: [
    {
      userId: data.createdBy,
      userName: data.userName,
      profilePic: data.profilePic,
    },
  ],
  queue: [],
  currentQueueIndex: -1,
  currentSongId: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentTrack: null,
    lastUpdate: Date.now(),
  },
  memberRTT: new Map(),
  settings: {
    allowAnyoneToAdd: true,
    maxQueueSize: data.planLimits?.realtimeSyncEnabled ? 50 : 3,
  },
  maxMembers: data.planLimits?.maxGroupMembers || 2,
  features: {
    realtimeChat: data.planLimits?.realtimeChatEnabled || false,
    realtimeSync: data.planLimits?.realtimeSyncEnabled || false,
  },
});

module.exports = {
  musicGroups,
  userGroups,
  TIME_TO_REJOIN,
  generateGroupId,
  generateQueueItemId,
  generateMessageId,
  emitActivityMessage,
  getGroup,
  getScheduledDelay,
  trackUserGroup,
  untrackUserGroup,
  getUserGroups,
  createGroupState,
};
