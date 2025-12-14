const QRCode = require('qrcode');

// Music group state
const musicGroups = new Map();
const userGroups = new Map(); // userId -> Set of groupIds

/**
 * Generate a unique group ID
 */
const generateGroupId = () => {
  const id = Math.floor(100000 + Math.random() * 900000).toString();
  return 'syncvibe_' + id;
};

/**
 * Get group by ID
 */
const getGroup = (groupId) => musicGroups.get(groupId);

/**
 * Add user to group tracking
 */
const trackUserGroup = (userId, groupId) => {
  if (!userGroups.has(userId)) {
    userGroups.set(userId, new Set());
  }
  userGroups.get(userId).add(groupId);
};

/**
 * Remove user from group tracking
 */
const untrackUserGroup = (userId, groupId) => {
  const groups = userGroups.get(userId);
  if (groups) {
    groups.delete(groupId);
    if (groups.size === 0) {
      userGroups.delete(userId);
    }
  }
};

/**
 * Get all groups a user is in
 */
const getUserGroups = (userId) => {
  return userGroups.get(userId) || new Set();
};

/**
 * Setup group music socket handlers
 */
const setupGroupMusicHandlers = (io, socket, userId, userSockets) => {
  // Time synchronization for accurate playback
  socket.on('time-sync-request', (data) => {
    socket.emit('time-sync-response', {
      clientTime: data.clientTime,
      serverTime: Date.now(),
    });
  });

  // Get all available music groups
  socket.on('get-music-groups', () => {
    socket.emit('music-groups', Array.from(musicGroups.values()));
  });

  // Create a new music group
  socket.on('create-music-group', async (data) => {
    const groupId = generateGroupId();
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
        errorCorrectionLevel: 'H',
        scale: 10,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const groupWithQR = {
        ...newGroup,
        qrCode: qrCodeBuffer.toString('base64'),
      };

      musicGroups.set(groupId, groupWithQR);
      socket.join(`music-group-${groupId}`);
      trackUserGroup(data.createdBy, groupId);

      io.to(data.createdBy).emit('group-created', groupWithQR);
    } catch (err) {
      console.error('QR Code Generation Failed:', err);
      socket.emit('error', { message: 'QR Code generation failed' });
    }
  });

  // Join an existing music group
  socket.on('join-music-group', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      socket.join(`music-group-${data.groupId}`);

      // Check if user already exists
      const existingMember = group.members.find((m) => m.userId === data.userId);
      if (!existingMember) {
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      }

      trackUserGroup(data.userId, data.groupId);

      socket.emit('group-joined', {
        group,
        members: group.members,
        playbackState: {
          ...group.playbackState,
          serverTime: Date.now(),
        },
      });

      socket.to(`music-group-${data.groupId}`).emit('member-joined', {
        userId: data.userId,
        userName: data.userName,
        profilePic: data.profilePic,
      });
    } else {
      socket.emit('group-not-found');
    }
  });

  // Rejoin a music group (after page refresh)
  socket.on('rejoin-music-group', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      socket.join(`music-group-${data.groupId}`);

      // Check if user already exists (reconnecting)
      const existingMemberIndex = group.members.findIndex((m) => m.userId === data.userId);
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

      trackUserGroup(data.userId, data.groupId);

      socket.emit('group-rejoined', {
        group,
        members: group.members,
        playbackState: {
          ...group.playbackState,
          serverTime: Date.now(),
        },
      });
    } else {
      socket.emit('group-not-found');
    }
  });

  // Request sync state (for periodic sync and drift correction)
  socket.on('request-sync', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      socket.emit('sync-state', {
        playbackState: {
          ...group.playbackState,
          serverTime: Date.now(),
        },
      });
    }
  });

  // Change the current song
  socket.on('music-change', (data) => {
    const { groupId, song, currentTime, scheduledTime } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    group.playbackState = {
      ...group.playbackState,
      currentTime,
      currentTrack: song,
      isPlaying: false,
      lastUpdate: Date.now(),
    };

    // Broadcast to all members in the group
    socket.to(`music-group-${groupId}`).emit('music-update', {
      song,
      currentTime,
      scheduledTime,
    });
  });

  // Update playback state (play/pause)
  socket.on('music-playback', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.playbackState = {
        ...group.playbackState, // Preserve currentTrack
        isPlaying: data.isPlaying,
        currentTime: data.currentTime,
        lastUpdate: Date.now(),
      };

      io.to(`music-group-${data.groupId}`).emit('playback-update', {
        isPlaying: data.isPlaying,
        currentTime: data.currentTime,
        scheduledTime: data.scheduledTime,
      });
    }
  });

  // Seek to a position
  socket.on('music-seek', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.playbackState = {
        ...group.playbackState,
        currentTime: data.currentTime,
        lastUpdate: Date.now(),
      };

      io.to(`music-group-${data.groupId}`).emit('playback-update', {
        isPlaying: data.isPlaying,
        currentTime: data.currentTime,
        scheduledTime: data.scheduledTime,
      });
    }
  });

  // Leave a group
  socket.on('leave-group', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.members = group.members.filter((member) => member.userId !== data.userId);
      untrackUserGroup(data.userId, data.groupId);
      socket.leave(`music-group-${data.groupId}`);

      socket.to(`music-group-${data.groupId}`).emit('member-left', {
        userId: data.userId,
      });

      // Delete group if empty
      if (group.members.length === 0) {
        musicGroups.delete(data.groupId);
        io.to(`music-group-${data.groupId}`).emit('group-disbanded');
      }
    }
  });

  // Group chat message
  socket.on('chat-message', (data) => {
    const { groupId } = data;
    io.to(`music-group-${groupId}`).emit('new-message', data);
  });
};

/**
 * Handle user disconnect with grace period for reconnection
 */
const handleUserDisconnect = (io, userId, userSockets) => {
  const userGroupSet = getUserGroups(userId);

  if (userGroupSet.size > 0) {
    // Give a grace period for reconnection (5 seconds)
    setTimeout(() => {
      // Check if user reconnected
      const reconnected = userSockets.has(userId);

      if (!reconnected) {
        userGroupSet.forEach((groupId) => {
          const group = musicGroups.get(groupId);

          if (group) {
            group.members = group.members.filter((m) => m.userId !== userId);
            io.to(`music-group-${groupId}`).emit('member-left', { userId });

            if (group.members.length === 0) {
              musicGroups.delete(groupId);
            }
          }
        });

        userGroups.delete(userId);
      }
    }, 5000);
  }
};

module.exports = {
  setupGroupMusicHandlers,
  handleUserDisconnect,
  getGroup,
  musicGroups,
};
