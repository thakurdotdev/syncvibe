import QRCode from 'qrcode';
import { Op } from 'sequelize';
import type { Server, Socket } from 'socket.io';
import { getUserPlanLimits } from '@/services/entitlement.service';
import { GroupInvite } from '@/models/index';
import {
  musicGroups,
  generateGroupId,
  generateMessageId,
  createGroupState,
  trackUserGroup,
  untrackUserGroup,
} from './state';
import { getQueueState } from './queue';
import { sendPushNotification } from '../notification';

interface CreateGroupSocketData {
  name: string;
  createdBy: string | number;
  userName: string;
  profilePic?: string;
}

interface JoinGroupSocketData {
  groupId: string;
  userId: string | number;
  userName: string;
  profilePic?: string;
}

interface ChatMessageSocketData {
  groupId: string;
  messageType?: string;
  gifUrl?: string;
  senderId?: string | number;
  profilePic?: string;
  userName?: string;
  message?: string;
  soundUrl?: string;
  soundName?: string;
  soundId?: string;
}

interface SendInviteSocketData {
  groupId: string;
  inviteeUserId: string | number;
  inviterName?: string;
  inviterPic?: string;
}

interface AcceptInviteSocketData {
  groupId: string;
  userId: string | number;
  userName: string;
  profilePic?: string;
  inviterId?: string | number;
}

export const setupInviteHandlers = (io: Server, socket: Socket, userId?: string | number): void => {
  socket.on('create-music-group', async (data: CreateGroupSocketData) => {
    const groupId = generateGroupId();

    let planLimits = null;
    try {
      planLimits = await getUserPlanLimits(data.createdBy);
    } catch (err) {
      console.error('Failed to fetch plan limits:', err);
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
        errorCorrectionLevel: 'H',
        scale: 10,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      const groupWithQR = {
        ...newGroup,
        qrCode: qrCodeBuffer.toString('base64'),
      };

      musicGroups.set(groupId, groupWithQR);
      socket.join(`music-group-${groupId}`);
      trackUserGroup(data.createdBy, groupId);

      socket.emit('group-created', groupWithQR);
      io.to(String(data.createdBy)).emit('group-created', groupWithQR);
    } catch (err) {
      console.error('QR Code Generation Failed:', err);
      socket.emit('error', { message: 'QR Code generation failed' });
    }
  });

  socket.on('join-music-group', (data: JoinGroupSocketData) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      const existingMember = group.members.find((m) => String(m.userId) === String(data.userId));

      if (!existingMember && group.members.length >= group.maxMembers) {
        socket.emit('group-full', {
          maxMembers: group.maxMembers,
          message: `Group is full (${group.maxMembers} members max)`,
        });
        return;
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

      const groupJoinedPayload = {
        group,
        members: group.members,
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
      };

      socket.emit('group-joined', groupJoinedPayload);
      io.to(String(data.userId)).emit('group-joined', groupJoinedPayload);

      socket.to(`music-group-${data.groupId}`).emit('member-joined', {
        userId: data.userId,
        userName: data.userName,
        profilePic: data.profilePic,
      });
    } else {
      socket.emit('group-not-found');
    }
  });

  socket.on('rejoin-music-group', async (data: JoinGroupSocketData) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      socket.join(`music-group-${data.groupId}`);

      const existingMemberIndex = group.members.findIndex(
        (m) => String(m.userId) === String(data.userId)
      );
      if (existingMemberIndex === -1) {
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });

        socket.to(`music-group-${data.groupId}`).emit('member-joined', {
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

      socket.emit('group-rejoined', {
        group,
        members: group.members,
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
      });
    } else {
      socket.emit('group-not-found');
    }
  });

  socket.on('leave-group', (data: { groupId: string; userId: string | number }) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.members = group.members.filter(
        (member) => String(member.userId) !== String(data.userId)
      );
      untrackUserGroup(data.userId, data.groupId);
      socket.leave(`music-group-${data.groupId}`);

      socket.to(`music-group-${data.groupId}`).emit('member-left', {
        userId: data.userId,
      });

      if (group.members.length === 0) {
        musicGroups.delete(data.groupId);
        io.to(`music-group-${data.groupId}`).emit('group-disbanded');
      }
    }
  });

  socket.on('chat-message', (data: ChatMessageSocketData) => {
    const { groupId, messageType, gifUrl } = data;
    const group = musicGroups.get(groupId);

    if (group && !group.features.realtimeChat) {
      socket.emit('feature-locked', {
        feature: 'realtimeChat',
        message: 'Real-time chat requires PRO plan',
      });
      return;
    }

    const enrichedMessage = {
      id: generateMessageId(),
      groupId,
      senderId: data.senderId,
      profilePic: data.profilePic,
      userName: data.userName,
      message: data.message,
      messageType: messageType || 'text',
      gifUrl: gifUrl || null,
      soundUrl: data.soundUrl || null,
      soundName: data.soundName || null,
      soundId: data.soundId || null,
      timestamp: Date.now(),
    };

    io.to(`music-group-${groupId}`).emit('new-message', enrichedMessage);
  });

  socket.on('song-reaction', (data: Record<string, unknown> & { groupId: string }) => {
    socket.to(`music-group-${data.groupId}`).emit('song-reaction', {
      ...data,
      id: generateMessageId(),
      timestamp: Date.now(),
    });
  });

  socket.on(
    'user-typing',
    (data: { groupId: string; userId: string | number; userName: string; isTyping: boolean }) => {
      socket.to(`music-group-${data.groupId}`).emit('user-typing', {
        userId: data.userId,
        userName: data.userName,
        isTyping: data.isTyping,
      });
    }
  );

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
    const { groupId, userId: inviteeId, userName, profilePic, inviterId } = data;
    const group = musicGroups.get(groupId);

    if (!group) {
      socket.emit('group-not-found');
      return;
    }

    const existingMember = group.members.find((m) => String(m.userId) === String(inviteeId));
    if (!existingMember && group.members.length >= group.maxMembers) {
      socket.emit('group-full', {
        maxMembers: group.maxMembers,
        message: `Group is full (${group.maxMembers} members max)`,
      });
      return;
    }

    socket.join(`music-group-${groupId}`);

    if (!existingMember) {
      group.members.push({ userId: inviteeId, userName, profilePic });
    }

    trackUserGroup(inviteeId, groupId);

    const groupJoinedPayload = {
      group,
      members: group.members,
      playbackState: { ...group.playbackState, serverTime: Date.now() },
      ...getQueueState(group),
    };

    socket.emit('group-joined', groupJoinedPayload);
    io.to(String(inviteeId)).emit('group-joined', groupJoinedPayload);

    socket.to(`music-group-${groupId}`).emit('member-joined', {
      userId: inviteeId,
      userName,
      profilePic,
    });

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
