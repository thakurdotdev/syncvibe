const { musicGroups, emitActivityMessage } = require("./state");
const {
  addToQueue,
  addPlayNext,
  removeFromQueue,
  skipToNext,
  prunePlayedSongs,
  reorderQueue,
  getQueueState,
} = require("./queue");

const setupQueueHandlers = (io, socket) => {
  socket.on("add-to-queue", (data) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = addToQueue(group, song, addedBy);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "add",
        item: result.queueItem,
      });

      emitActivityMessage(io, groupId, "song-added", {
        userName: addedBy.userName,
        songName: song.name,
      });

      if (result.autoPlay && group.queue.length === 1) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + 2000;
        io.to(`music-group-${groupId}`).emit("music-update", {
          song: result.queueItem.song,
          currentTime: 0,
          queueItem: result.queueItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.isPlaying = true;
        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, "song-playing", {
          songName: song.name,
          addedBy: addedBy.userName,
        });
      }
    } else {
      socket.emit("queue-error", { error: result.error });
    }
  });

  socket.on("play-next", (data) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = addPlayNext(group, song, addedBy);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "play-next",
        item: result.queueItem,
      });

      emitActivityMessage(io, groupId, "song-added", {
        userName: addedBy.userName,
        songName: song.name,
      });

      if (result.autoPlay) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + 2000;
        io.to(`music-group-${groupId}`).emit("music-update", {
          song: result.queueItem.song,
          currentTime: 0,
          queueItem: result.queueItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.isPlaying = true;
        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, "song-playing", {
          songName: song.name,
          addedBy: addedBy.userName,
        });
      }
    } else {
      socket.emit("queue-error", { error: result.error });
    }
  });

  socket.on("add-playlist-to-queue", (data) => {
    const { groupId, songs, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    let addedCount = 0;
    const errors = [];

    for (const song of songs) {
      const result = addToQueue(group, song, addedBy);
      if (result.success) {
        addedCount++;
        if (result.autoPlay && addedCount === 1) {
          const serverTime = Date.now();
          const scheduledPlayTime = serverTime + 2000;
          io.to(`music-group-${groupId}`).emit("music-update", {
            song: result.queueItem.song,
            currentTime: 0,
            queueItem: result.queueItem,
            scheduledPlayTime,
            serverTime,
          });
          group.playbackState.isPlaying = true;
          group.playbackState.currentTime = 0;
          group.playbackState.lastUpdate = scheduledPlayTime;

          emitActivityMessage(io, groupId, "song-playing", {
            songName: song.name,
            addedBy: addedBy.userName,
          });
        }
      } else {
        if (result.error === "Queue is full") break;
        errors.push(result.error);
      }
    }

    if (addedCount > 0) {
      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "playlist-added",
        addedCount,
      });
    }

    if (addedCount === 0 && errors.length > 0) {
      socket.emit("queue-error", { error: errors[0] });
    }
  });

  socket.on("remove-from-queue", (data) => {
    const { groupId, queueItemId, userId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = removeFromQueue(group, queueItemId, userId);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "remove",
        removedId: queueItemId,
      });
    } else {
      socket.emit("queue-error", { error: result.error });
    }
  });

  socket.on("skip-song", (data) => {
    const { groupId, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = skipToNext(group);

    if (result.success) {
      prunePlayedSongs(group);

      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "skip",
      });

      emitActivityMessage(io, groupId, "song-skipped", { userName });

      if (result.hasNext) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + 2000;
        io.to(`music-group-${groupId}`).emit("music-update", {
          song: result.currentItem.song,
          currentTime: 0,
          queueItem: result.currentItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, "song-playing", {
          songName: result.currentItem.song.name,
          addedBy: result.currentItem.addedBy?.userName,
        });
      } else {
        io.to(`music-group-${groupId}`).emit("queue-ended");
        emitActivityMessage(io, groupId, "queue-ended", {});
      }
    }
  });

  socket.on("song-ended", (data) => {
    const { groupId, songId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = skipToNext(group, songId);

    if (result.alreadyAdvanced) {
      console.log(`Ignoring duplicate song-ended for song ${songId}`);
      return;
    }

    if (!result.success) return;

    prunePlayedSongs(group);

    io.to(`music-group-${groupId}`).emit("queue-updated", {
      ...getQueueState(group),
      action: "song-ended",
    });

    if (result.hasNext) {
      const serverTime = Date.now();
      const scheduledPlayTime = serverTime + 2000;
      io.to(`music-group-${groupId}`).emit("music-update", {
        song: result.currentItem.song,
        currentTime: 0,
        queueItem: result.currentItem,
        autoPlay: true,
        scheduledPlayTime,
        serverTime,
      });

      group.playbackState.currentTime = 0;
      group.playbackState.lastUpdate = scheduledPlayTime;

      emitActivityMessage(io, groupId, "song-playing", {
        songName: result.currentItem.song.name,
        addedBy: result.currentItem.addedBy?.userName,
      });
    } else {
      io.to(`music-group-${groupId}`).emit("queue-ended");
      emitActivityMessage(io, groupId, "queue-ended", {});
    }
  });

  socket.on("reorder-queue", (data) => {
    const { groupId, fromIndex, toIndex } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = reorderQueue(group, fromIndex, toIndex);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit("queue-updated", {
        ...getQueueState(group),
        action: "reorder",
      });
    } else {
      socket.emit("queue-error", { error: result.error });
    }
  });
};

module.exports = {
  setupQueueHandlers,
};
