const {
  musicGroups,
  getGroup,
  TIME_TO_REJOIN,
  getUserGroups,
} = require("./groupMusic/state");
const { getQueueState } = require("./groupMusic/queue");
const { setupQueueHandlers } = require("./groupMusic/queueHandlers");
const { setupPlaybackHandlers } = require("./groupMusic/playbackHandlers");
const { setupInviteHandlers } = require("./groupMusic/inviteHandlers");

const setupGroupMusicHandlers = (io, socket, userId, userSockets) => {
  socket.on("time-sync-request", (data) => {
    const rtt = Date.now() - data.clientTime;
    const userGroupSet = getUserGroups(userId);
    userGroupSet.forEach((groupId) => {
      const group = musicGroups.get(groupId);
      if (group) group.memberRTT.set(userId, rtt);
    });

    socket.emit("time-sync-response", {
      clientTime: data.clientTime,
      serverTime: Date.now(),
    });
  });

  socket.on("get-music-groups", () => {
    socket.emit("music-groups", Array.from(musicGroups.values()));
  });

  socket.on("request-sync", (data) => {
    const group = musicGroups.get(data.groupId);
    if (!group) return;

    const currentItem =
      group.currentQueueIndex >= 0
        ? group.queue[group.currentQueueIndex]
        : null;
    const serverTime = Date.now();

    socket.emit("sync-state", {
      playbackState: {
        ...group.playbackState,
        serverTime,
        currentTrack: currentItem?.song || null,
      },
      ...getQueueState(group),
      currentSongId: group.currentSongId,
    });
  });

  setupQueueHandlers(io, socket);
  setupPlaybackHandlers(io, socket);
  setupInviteHandlers(io, socket, userId);
};

const handleUserDisconnect = (io, userId, userSockets) => {
  const userGroupSet = getUserGroups(userId);

  if (userGroupSet.size > 0) {
    setTimeout(() => {
      const reconnected = userSockets.has(userId);

      if (!reconnected) {
        userGroupSet.forEach((groupId) => {
          const group = musicGroups.get(groupId);

          if (group) {
            group.members = group.members.filter((m) => m.userId !== userId);
            io.to(`music-group-${groupId}`).emit("member-left", { userId });

            if (group.members.length === 0) {
              musicGroups.delete(groupId);
            }
          }
        });

        const { userGroups } = require("./groupMusic/state");
        userGroups.delete(userId);
      }
    }, TIME_TO_REJOIN);
  }
};

module.exports = {
  setupGroupMusicHandlers,
  handleUserDisconnect,
  getGroup,
  musicGroups,
};
