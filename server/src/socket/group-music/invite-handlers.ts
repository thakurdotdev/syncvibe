import { cancelRemoval, claimRoomDevice, enterRoom, markMemberPresent } from './presence';
import QRCode from 'qrcode';
import { Op } from 'sequelize';
import type { Server, Socket } from 'socket.io';
import { getUserPlanLimits } from '@/services/entitlement.service';
import { GroupInvite } from '@/models/index';
import {
  allRoomsOf,
  musicGroups,
  generateGroupId,
  createGroupState,
  roomOf,
  trackUserGroup,
  untrackUserGroup,
  removeGroup,
} from './state';
import { joinPayloadOf, publicGroupOf } from './broadcast';
import { handleMemberGone } from './host';
import { touchRoom } from './room-store';
import { sendPushNotification } from '../notification';

interface CreateGroupSocketData {
  deviceId?: string;
  /** 2 for devices on the current sync protocol. Older versions don't send it. */
  protocol?: number;
  name: string;
  createdBy: string | number;
  userName: string;
  profilePic?: string;
}

interface JoinGroupSocketData {
  deviceId?: string;
  /** 2 for devices on the current sync protocol. Older versions don't send it. */
  protocol?: number;
  groupId: string;
  userId: string | number;
  userName: string;
  profilePic?: string;
}

interface SendInviteSocketData {
  groupId: string;
  inviteeUserId: string | number;
  inviterName?: string;
  inviterPic?: string;
}

interface AcceptInviteSocketData extends JoinGroupSocketData {
  inviterId?: string | number;
}

export const setupInviteHandlers = (io: Server, socket: Socket, userId?: string | number): void => {
  /** Who is asking comes from the connection. A request naming someone else is ignored. */
  const isSelf = (claimed: string | number | undefined) =>
    userId != null && claimed != null && String(claimed) === String(userId);

  socket.on('create-music-group', async (data: CreateGroupSocketData) => {
    if (!isSelf(data?.createdBy)) return;
    const groupId = generateGroupId();

    let planLimits = null;
    try {
      planLimits = await getUserPlanLimits(data.createdBy);
    } catch (err) {
      console.error('Failed to fetch plan limits:', err);
    }

    const group = createGroupState({
      id: groupId,
      name: data.name,
      createdBy: data.createdBy,
      userName: data.userName,
      profilePic: data.profilePic,
      planLimits,
    });

    try {
      const qrCodeBuffer = await QRCode.toBuffer(groupId, {
        errorCorrectionLevel: 'H',
        scale: 10,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      group.qrCode = qrCodeBuffer.toString('base64');

      musicGroups.set(groupId, group);
      touchRoom(group, 'core', 'queue');
      enterRoom(socket, groupId, data.protocol);
      trackUserGroup(data.createdBy, groupId);

      socket.data.deviceId = data.deviceId;
      socket.emit('group-created', { ...publicGroupOf(group), sync: joinPayloadOf(group).sync });
    } catch (err) {
      console.error('QR Code Generation Failed:', err);
      socket.emit('error', { message: 'QR Code generation failed' });
    }
  });

  /** Joining on purpose: by code, QR or invite. Takes the room over from your other devices. */
  const join = (data: JoinGroupSocketData): boolean => {
    if (!isSelf(data?.userId)) return false;
    const group = musicGroups.get(data.groupId);
    if (!group) {
      socket.emit('group-not-found');
      return false;
    }

    const existingMember = group.members.find((m) => String(m.userId) === String(data.userId));
    if (!existingMember && group.members.length >= group.maxMembers) {
      socket.emit('group-full', {
        maxMembers: group.maxMembers,
        message: `Group is full (${group.maxMembers} members max)`,
      });
      return false;
    }

    claimRoomDevice(io, socket, data.groupId, data.userId, data.deviceId, true);
    enterRoom(socket, data.groupId, data.protocol);

    if (!existingMember) {
      group.members.push({
        userId: data.userId,
        userName: data.userName,
        profilePic: data.profilePic,
      });
    }

    trackUserGroup(data.userId, data.groupId);
    markMemberPresent(io, data.groupId, data.userId);
    if (!existingMember) touchRoom(group, 'core');

    // Only to this device: sent to all of a user's devices, it pulled the others' screens and
    // audio into a room their connections weren't in.
    socket.emit('group-joined', joinPayloadOf(group));

    if (!existingMember) {
      socket.to(roomOf(data.groupId)).emit('member-joined', {
        userId: data.userId,
        userName: data.userName,
        profilePic: data.profilePic,
      });
    }
    return true;
  };

  socket.on('join-music-group', (data: JoinGroupSocketData) => {
    join(data);
  });

  socket.on('rejoin-music-group', async (data: JoinGroupSocketData) => {
    if (!isSelf(data?.userId)) return;
    const group = musicGroups.get(data.groupId);

    if (group) {
      if (!claimRoomDevice(io, socket, data.groupId, data.userId, data.deviceId, false)) {
        socket.emit('device-replaced', { groupId: data.groupId });
        return;
      }
      enterRoom(socket, data.groupId, data.protocol);

      const existingMemberIndex = group.members.findIndex(
        (m) => String(m.userId) === String(data.userId)
      );
      if (existingMemberIndex === -1) {
        // Gone long enough to have been counted as leaving, and the room filled up meanwhile.
        if (group.members.length >= group.maxMembers) {
          for (const room of allRoomsOf(data.groupId)) socket.leave(room);
          socket.emit('group-full', {
            maxMembers: group.maxMembers,
            message: `Group is full (${group.maxMembers} members max)`,
          });
          return;
        }
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });

        socket.to(roomOf(data.groupId)).emit('member-joined', {
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      }

      if (String(group.createdBy) === String(data.userId)) {
        try {
          const planLimits = await getUserPlanLimits(data.userId);
          if (planLimits) {
            group.features.realtimeChat = Boolean(planLimits.realtimeChatEnabled);
            group.features.realtimeSync = Boolean(planLimits.realtimeSyncEnabled);
            group.maxMembers = planLimits.maxGroupMembers || group.maxMembers;
            group.settings.maxQueueSize = planLimits.realtimeSyncEnabled
              ? 50
              : group.settings.maxQueueSize;
          }
        } catch (err) {
          console.error('Failed to refresh plan limits on rejoin:', err);
        }
      }

      trackUserGroup(data.userId, data.groupId);
      markMemberPresent(io, data.groupId, data.userId);
      touchRoom(group, 'core');

      socket.emit('group-rejoined', joinPayloadOf(group));
    } else {
      socket.emit('group-not-found');
    }
  });

  socket.on('leave-group', (data: { groupId: string; userId: string | number }) => {
    if (!isSelf(data?.userId)) return;
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.members = group.members.filter(
        (member) => String(member.userId) !== String(data.userId)
      );
      untrackUserGroup(data.userId, data.groupId);
      cancelRemoval(data.groupId, data.userId);

      // Leaving is for the person, not the device: otherwise their other device would keep
      // getting the room's songs after they'd left.
      io.in(String(data.userId)).socketsLeave(allRoomsOf(data.groupId));
      for (const room of allRoomsOf(data.groupId)) socket.leave(room);
      socket.to(String(data.userId)).emit('left-group', { groupId: data.groupId });

      io.to(roomOf(data.groupId)).emit('member-left', {
        userId: data.userId,
      });
      handleMemberGone(io, group, data.userId);
      touchRoom(group, 'core');

      if (group.members.length === 0) {
        removeGroup(data.groupId);
        io.to(roomOf(data.groupId)).emit('group-disbanded');
      }
    }
  });

  socket.on('send-group-invite', async (data: SendInviteSocketData) => {
    const { groupId, inviteeUserId, inviterName, inviterPic } = data;
    const group = musicGroups.get(groupId);

    if (!group) {
      socket.emit('invite-error', { error: 'Group not found' });
      return;
    }

    const isMember = group.members.some((m) => String(m.userId) === String(userId));
    if (!isMember) {
      socket.emit('invite-error', { error: 'You are not in this group' });
      return;
    }

    const alreadyIn = group.members.some((m) => String(m.userId) === String(inviteeUserId));
    if (alreadyIn) {
      socket.emit('invite-error', { error: 'User is already in the group' });
      return;
    }

    if (group.members.length >= group.maxMembers) {
      socket.emit('invite-error', { error: 'Group is full' });
      return;
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
    io.to(String(inviteeUserId)).emit('group-invite-received', invitePayload);
    socket.emit('invite-sent', { inviteeUserId });

    sendPushNotification(inviteeUserId, invitePayload, 'group-invite').catch((err) =>
      console.error('Failed to send invite push notification:', err)
    );

    GroupInvite.create({
      groupId,
      groupName: group.name,
      inviterId: Number(userId),
      inviterName: inviterName || 'User',
      inviterPic: inviterPic || null,
      inviteeId: Number(inviteeUserId),
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).catch((err: Error) => console.error('Failed to persist invite:', err));
  });

  socket.on('accept-group-invite', (data: AcceptInviteSocketData) => {
    const { groupId, userId: inviteeId, userName, inviterId } = data;
    if (!join(data)) return;

    if (inviterId) {
      io.to(String(inviterId)).emit('invite-accepted', { userId: inviteeId, userName });
    }

    GroupInvite.destroy({
      where: { groupId, inviteeId: Number(inviteeId), status: 'pending' },
    }).catch((err: Error) => console.error('Failed to delete invite record:', err));
  });

  socket.on('decline-group-invite', (data: { groupId: string; inviterId?: string | number }) => {
    const { groupId, inviterId } = data;

    if (inviterId) {
      io.to(String(inviterId)).emit('group-invite-declined', {
        userId,
        groupId,
      });
    }

    GroupInvite.destroy({
      where: { groupId, inviteeId: Number(userId), status: 'pending' },
    }).catch((err: Error) => console.error('Failed to delete invite record:', err));
  });

  const checkInvites = async () => {
    if (!userId) return;
    try {
      const invites = await GroupInvite.findAll({
        where: {
          inviteeId: Number(userId),
          status: 'pending',
          expiresAt: { [Op.gt]: new Date() },
        },
        order: [['createdAt', 'DESC']],
        limit: 1,
        raw: true,
      });

      if (invites.length > 0) {
        const invite = invites[0]!;
        const group = musicGroups.get(invite.groupId);
        if (group) {
          socket.emit('group-invite-received', {
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
      console.error('Auto-fetch invites error:', err);
    }
  };

  socket.on('get-pending-invites', async () => {
    await checkInvites();
  });

  checkInvites().catch(console.error);
};
