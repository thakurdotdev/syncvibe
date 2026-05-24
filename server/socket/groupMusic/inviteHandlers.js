const QRCode = require("qrcode");
const { getUserPlanLimits } = require("../../services/entitlementService");
const GroupInvite = require("../../models/music/groupInviteModel");
const {
  musicGroups,
  generateGroupId,
  createGroupState,
  trackUserGroup,
  untrackUserGroup,
} = require("./state");
const { getQueueState } = require("./queue");

const setupInviteHandlers = (io, socket, userId) => {
  socket.on("create-music-group", async (data) => {
    const groupId = generateGroupId();

    let planLimits;
    try {
      planLimits = await getUserPlanLimits(data.createdBy);
    } catch (err) {
      console.error("Failed to fetch plan limits:", err);
    }

    const newGroup = createGroupState({
      id: groupId,
      name: data.name,
      createdBy: data.createdBy,
      userName: data.userName,
      profilePic: data.profilePic,
      planLimits,
    });

    try {
      const qrCodeBuffer = await QRCode.toBuffer(groupId, {
        errorCorrectionLevel: "H",
        scale: 10,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const groupWithQR = {
        ...newGroup,
        qrCode: qrCodeBuffer.toString("base64"),
      };

      musicGroups.set(groupId, groupWithQR);
      socket.join(`music-group-${groupId}`);
      trackUserGroup(data.createdBy, groupId);

      io.to(data.createdBy).emit("group-created", groupWithQR);
    } catch (err) {
      console.error("QR Code Generation Failed:", err);
      socket.emit("error", { message: "QR Code generation failed" });
    }
  });

  socket.on("join-music-group", (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      const existingMember = group.members.find(
        (m) => m.userId === data.userId,
      );

      if (!existingMember && group.members.length >= group.maxMembers) {
        return socket.emit("group-full", {
          maxMembers: group.maxMembers,
          message: `Group is full (${group.maxMembers} members max)`,
        });
      }

      socket.join(`music-group-${data.groupId}`);

      if (!existingMember) {
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      }

      trackUserGroup(data.userId, data.groupId);

      socket.emit("group-joined", {
        group,
        members: group.members,
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
      });

      socket.to(`music-group-${data.groupId}`).emit("member-joined", {
        userId: data.userId,
        userName: data.userName,
        profilePic: data.profilePic,
      });
    } else {
      socket.emit("group-not-found");
    }
  });

  socket.on("rejoin-music-group", async (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      socket.join(`music-group-${data.groupId}`);

      const existingMemberIndex = group.members.findIndex(
        (m) => m.userId === data.userId,
      );
      if (existingMemberIndex === -1) {
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });

        socket.to(`music-group-${data.groupId}`).emit("member-joined", {
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      }

      if (group.createdBy === data.userId) {
        try {
          const planLimits = await getUserPlanLimits(data.userId);
          if (planLimits) {
            group.features.realtimeChat =
              planLimits.realtimeChatEnabled || false;
            group.features.realtimeSync =
              planLimits.realtimeSyncEnabled || false;
            group.maxMembers = planLimits.maxGroupMembers || group.maxMembers;
            group.settings.maxQueueSize = planLimits.realtimeSyncEnabled
              ? 50
              : group.settings.maxQueueSize;
          }
        } catch (err) {
          console.error("Failed to refresh plan limits on rejoin:", err);
        }
      }

      trackUserGroup(data.userId, data.groupId);

      socket.emit("group-rejoined", {
        group,
        members: group.members,
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
      });
    } else {
      socket.emit("group-not-found");
    }
  });

  socket.on("leave-group", (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.members = group.members.filter(
        (member) => member.userId !== data.userId,
      );
      untrackUserGroup(data.userId, data.groupId);
      socket.leave(`music-group-${data.groupId}`);

      socket.to(`music-group-${data.groupId}`).emit("member-left", {
        userId: data.userId,
      });

      if (group.members.length === 0) {
        musicGroups.delete(data.groupId);
        io.to(`music-group-${data.groupId}`).emit("group-disbanded");
      }
    }
  });

  socket.on("chat-message", (data) => {
    const { groupId } = data;
    const group = musicGroups.get(groupId);

    if (group && !group.features.realtimeChat) {
      return socket.emit("feature-locked", {
        feature: "realtimeChat",
        message: "Real-time chat requires PRO plan",
      });
    }

    io.to(`music-group-${groupId}`).emit("new-message", data);
  });

  socket.on("typing-start", (data) => {
    const { groupId, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group || !group.features.realtimeChat) return;
    socket.to(`music-group-${groupId}`).emit("user-typing", {
      userId,
      userName,
      isTyping: true,
    });
  });

  socket.on("typing-stop", (data) => {
    const { groupId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;
    socket.to(`music-group-${groupId}`).emit("user-typing", {
      userId,
      isTyping: false,
    });
  });

  socket.on("send-group-invite", async (data) => {
    const { groupId, inviteeUserId, inviterName, inviterPic } = data;
    const group = musicGroups.get(groupId);

    if (!group)
      return socket.emit("invite-error", { error: "Group not found" });

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember)
      return socket.emit("invite-error", {
        error: "You are not in this group",
      });

    const alreadyIn = group.members.some((m) => m.userId === inviteeUserId);
    if (alreadyIn)
      return socket.emit("invite-error", {
        error: "User is already in the group",
      });

    if (group.members.length >= group.maxMembers) {
      return socket.emit("invite-error", { error: "Group is full" });
    }

    const invitePayload = {
      groupId,
      groupName: group.name,
      inviterName,
      inviterPic,
      inviterId: userId,
      timestamp: Date.now(),
    };

    console.log(`Sending real-time invite from ${userId} to ${inviteeUserId}`);
    io.to(inviteeUserId).emit("group-invite-received", invitePayload);
    socket.emit("invite-sent", { inviteeUserId });

    GroupInvite.create({
      groupId,
      groupName: group.name,
      inviterId: userId,
      inviterName,
      inviterPic,
      inviteeId: inviteeUserId,
      status: "pending",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).catch((err) => console.error("Failed to persist invite:", err));
  });

  socket.on("accept-group-invite", (data) => {
    const {
      groupId,
      userId: inviteeId,
      userName,
      profilePic,
      inviterId,
    } = data;
    const group = musicGroups.get(groupId);

    if (!group) return socket.emit("group-not-found");

    const existingMember = group.members.find((m) => m.userId === inviteeId);
    if (!existingMember && group.members.length >= group.maxMembers) {
      return socket.emit("group-full", {
        maxMembers: group.maxMembers,
        message: `Group is full (${group.maxMembers} members max)`,
      });
    }

    socket.join(`music-group-${groupId}`);

    if (!existingMember) {
      group.members.push({ userId: inviteeId, userName, profilePic });
    }

    trackUserGroup(inviteeId, groupId);

    socket.emit("group-joined", {
      group,
      members: group.members,
      playbackState: { ...group.playbackState, serverTime: Date.now() },
      ...getQueueState(group),
    });

    socket.to(`music-group-${groupId}`).emit("member-joined", {
      userId: inviteeId,
      userName,
      profilePic,
    });

    if (inviterId) {
      io.to(inviterId).emit("invite-accepted", { userId: inviteeId, userName });
    }

    GroupInvite.destroy({
      where: { groupId, inviteeId, status: "pending" },
    }).catch((err) => console.error("Failed to delete invite record:", err));
  });

  socket.on("decline-group-invite", (data) => {
    const { groupId, inviterId } = data;

    if (inviterId) {
      io.to(String(inviterId)).emit("group-invite-declined", {
        userId,
        groupId,
      });
    }

    GroupInvite.destroy({
      where: { groupId, inviteeId: userId, status: "pending" },
    }).catch((err) => console.error("Failed to delete invite record:", err));
  });

  socket.on("get-pending-invites", async () => {
    try {
      const invites = await GroupInvite.findAll({
        where: {
          inviteeId: userId,
          status: "pending",
          expiresAt: { [require("sequelize").Op.gt]: new Date() },
        },
        order: [["createdAt", "DESC"]],
        limit: 1,
        raw: true,
      });

      if (invites.length > 0) {
        const invite = invites[0];
        const group = musicGroups.get(invite.groupId);
        if (group) {
          socket.emit("group-invite-received", {
            groupId: invite.groupId,
            groupName: invite.groupName,
            inviterName: invite.inviterName,
            inviterPic: invite.inviterPic,
            inviterId: invite.inviterId,
            timestamp: new Date(invite.createdAt).getTime(),
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch pending invites:", err);
    }
  });

  const checkInvites = async () => {
    try {
      const invites = await GroupInvite.findAll({
        where: {
          inviteeId: userId,
          status: "pending",
          expiresAt: { [require("sequelize").Op.gt]: new Date() },
        },
        order: [["createdAt", "DESC"]],
        limit: 1,
        raw: true,
      });

      if (invites.length > 0) {
        const invite = invites[0];
        const group = musicGroups.get(invite.groupId);
        if (group) {
          socket.emit("group-invite-received", {
            groupId: invite.groupId,
            groupName: invite.groupName,
            inviterName: invite.inviterName,
            inviterPic: invite.inviterPic,
            inviterId: invite.inviterId,
            timestamp: new Date(invite.createdAt).getTime(),
          });
        }
      }
    } catch (err) {
      console.error("Auto-fetch invites error:", err);
    }
  };
  checkInvites();
};

module.exports = {
  setupInviteHandlers,
};
