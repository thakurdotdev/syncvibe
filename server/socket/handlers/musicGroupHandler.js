const QRCode = require("qrcode");

/**
 * Handles music group functionality
 */
class MusicGroupHandler {
  constructor() {
    this.musicGroups = new Map();
  }

  /**
   * Register socket handlers for music group functionality
   * @param {Object} socket - Socket.io socket instance
   * @param {Object} io - Socket.io server instance
   * @param {string} userId - Current user ID
   */
  registerHandlers(socket, io, userId) {
    socket.on("time-sync-request", (data) => {
      socket.emit("time-sync-response", {
        clientTime: data.clientTime,
        serverTime: Date.now(),
      });
    });

    socket.on("get-music-groups", () => {
      socket.emit("music-groups", Array.from(this.musicGroups.values()));
    });

    socket.on("create-music-group", async (data) => {
      let groupId = Math.floor(100000 + Math.random() * 900000).toString();
      groupId = "syncvibe_" + groupId; // Prefix with 'syncvibe_'
      const newGroup = {
        id: groupId,
        name: data.name,
        createdBy: data.createdBy,
        members: [
          {
            userId: data.createdBy,
            userName: data.userName,
            profilePic: data.profilePic,
          },
        ],
        playbackState: {
          isPlaying: false,
          currentTime: 0,
          currentTrack: null,
          lastUpdate: Date.now(),
        },
      };

      try {
        const qrCodeBuffer = await QRCode.toBuffer(groupId, {
          errorCorrectionLevel: "H",
          scale: 10,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        this.musicGroups.set(groupId, {
          ...newGroup,
          qrCode: qrCodeBuffer.toString("base64"),
        });
        socket.join(`music-group-${groupId}`);

        io.to(data.createdBy).emit("group-created", {
          ...newGroup,
          qrCode: qrCodeBuffer.toString("base64"),
        });
      } catch (err) {
        console.error("QR Code Generation Failed:", err);
        socket.emit("error", { message: "QR Code generation failed" });
      }
    });

    socket.on("join-music-group", (data) => {
      const group = this.musicGroups.get(data.groupId);

      if (group) {
        socket.join(`music-group-${data.groupId}`);
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });

        socket.emit("group-joined", {
          group,
          members: group.members,
          playbackState: group.playbackState,
        });

        socket.to(`music-group-${data.groupId}`).emit("member-joined", {
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      } else {
        io.to(userId).emit("group-not-found");
      }
    });

    socket.on("music-change", (data) => {
      const { groupId, song, currentTime, scheduledTime } = data;

      const group = this.musicGroups.get(groupId);
      if (!group) {
        return;
      }

      group.playbackState = {
        currentTime,
        currentTrack: song,
        lastUpdate: Date.now(),
      };
      // Broadcast to all members in the group
      socket.to(`music-group-${groupId}`).emit("music-update", {
        song,
        currentTime,
        scheduledTime,
      });
    });

    socket.on("music-playback", (data) => {
      const group = this.musicGroups.get(data.groupId);
      if (group) {
        group.playbackState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          lastUpdate: Date.now(),
        };

        io.to(`music-group-${data.groupId}`).emit("playback-update", {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          scheduledTime: data.scheduledTime,
        });
      }
    });

    socket.on("music-seek", (data) => {
      const group = this.musicGroups.get(data.groupId);
      if (group) {
        group.playbackState = {
          ...group.playbackState,
          currentTime: data.currentTime,
          lastUpdate: Date.now(),
        };

        io.to(`music-group-${data.groupId}`).emit("playback-update", {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          scheduledTime: data.scheduledTime,
        });
      }
    });

    socket.on("leave-group", (data) => {
      const group = this.musicGroups.get(data.groupId);
      if (group) {
        group.members = group.members.filter(
          (member) => member.userId !== data.userId,
        );

        socket.to(`music-group-${data.groupId}`).emit("member-left", {
          userId: data.userId,
        });

        if (group.members.length === 0) {
          this.musicGroups.delete(data.groupId);
          socket.to(`music-group-${data.groupId}`).emit("group-disbanded");
        }
      }
    });

    socket.on("chat-message", (data) => {
      const { groupId } = data;
      io.to(`music-group-${groupId}`).emit("new-message", data);
    });
  }

  /**
   * Handle user disconnect from music groups
   * @param {Object} socket - Socket.io socket instance
   * @param {string} userId - User ID
   */
  handleDisconnect(socket, userId) {
    // Get all group IDs that the user is a member of
    const groupsToUpdate = [];
    this.musicGroups.forEach((group, groupId) => {
      const isMember = group.members.some((member) => member.userId === userId);
      if (isMember) {
        groupsToUpdate.push(groupId);
      }
    });

    // Update each group
    groupsToUpdate.forEach((groupId) => {
      const group = this.musicGroups.get(groupId);
      group.members = group.members.filter(
        (member) => member.userId !== userId,
      );

      socket.to(`music-group-${groupId}`).emit("member-left", {
        userId,
      });

      if (group.members.length === 0) {
        this.musicGroups.delete(groupId);
        socket.to(`music-group-${groupId}`).emit("group-disbanded");
      }
    });

    return groupsToUpdate;
  }
}

module.exports = new MusicGroupHandler();
