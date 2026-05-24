const { musicGroups, getScheduledDelay } = require("./state");
const {
  prunePlayedSongs,
  getQueueState,
  generateQueueItemId,
} = require("./queue");

const setupPlaybackHandlers = (io, socket) => {
  socket.on("music-change", (data) => {
    const { groupId, song, currentTime, scheduledTime, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const queueItem = {
      id: generateQueueItemId(),
      song,
      addedBy: addedBy || {
        userId: "unknown",
        userName: "Unknown",
        profilePic: "",
      },
      addedAt: Date.now(),
      status: "playing",
    };

    group.queue.forEach((item, idx) => {
      if (idx <= group.currentQueueIndex) {
        item.status = "played";
      }
    });

    const insertIndex =
      group.currentQueueIndex >= 0 ? group.currentQueueIndex + 1 : 0;
    group.queue.splice(insertIndex, 0, queueItem);
    group.currentQueueIndex = insertIndex;
    group.currentSongId = queueItem.id;

    prunePlayedSongs(group);

    const serverTime = Date.now();
    const scheduledPlayTime = serverTime + getScheduledDelay(group);

    group.playbackState = {
      ...group.playbackState,
      currentTime: 0,
      currentTrack: song,
      isPlaying: true,
      lastUpdate: scheduledPlayTime,
    };

    io.to(`music-group-${groupId}`).emit("music-update", {
      song,
      currentTime: 0,
      queueItem,
      scheduledPlayTime,
      serverTime,
    });

    io.to(`music-group-${groupId}`).emit("queue-updated", {
      ...getQueueState(group),
      action: "play-now",
    });
  });

  socket.on("music-playback", (data) => {
    const group = musicGroups.get(data.groupId);
    if (!group) return;

    const serverTime = Date.now();
    group.playbackState = {
      ...group.playbackState,
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      lastUpdate: serverTime,
    };

    io.to(`music-group-${data.groupId}`).emit("playback-update", {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      serverTime,
    });
  });

  socket.on("music-seek", (data) => {
    const group = musicGroups.get(data.groupId);
    if (!group) return;

    const serverTime = Date.now();
    group.playbackState = {
      ...group.playbackState,
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      lastUpdate: serverTime,
    };

    io.to(`music-group-${data.groupId}`).emit("playback-update", {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      serverTime,
      isSeeking: true,
    });
  });

  socket.on("song-reaction", (data) => {
    const { groupId, emoji, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    socket.to(`music-group-${groupId}`).emit("song-reaction", {
      emoji,
      userName,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    });
  });
};

module.exports = {
  setupPlaybackHandlers,
};
