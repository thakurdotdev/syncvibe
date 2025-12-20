const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// Music group state
const musicGroups = new Map();
const userGroups = new Map(); // userId -> Set of groupIds

const TIME_TO_REJOIN = 10000; // 10 seconds

/**
 * Generate a unique group ID
 */
const generateGroupId = () => {
  const id = Math.floor(100000 + Math.random() * 900000).toString();
  return 'syncvibe_' + id;
};

/**
 * Generate a unique queue item ID
 */
const generateQueueItemId = () => uuidv4();

/**
 * Generate a unique message ID
 */
const generateMessageId = () => uuidv4();

/**
 * Emit an activity message to group chat
 */
const emitActivityMessage = (io, groupId, activityType, data) => {
  const activityMessages = {
    'song-added': `🎵 ${data.userName} added "${data.songName}" to the queue`,
    'song-playing': `▶️ Now playing "${data.songName}"${data.addedBy ? ` (added by ${data.addedBy})` : ''}`,
    'song-skipped': `⏭️ ${data.userName || 'Someone'} skipped to the next song`,
    'queue-ended': `🎶 Queue ended - add more songs!`,
    'user-joined': `👋 ${data.userName} joined the session`,
    'user-left': `👋 ${data.userName} left the session`,
  };

  const message = activityMessages[activityType];
  if (!message) return;

  io.to(`music-group-${groupId}`).emit('new-message', {
    id: generateMessageId(),
    groupId,
    type: 'activity',
    activityType,
    message,
    timestamp: Date.now(),
  });
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
 * Create a new group state object
 */
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
  // Queue system
  queue: [],
  currentQueueIndex: -1,
  currentSongId: null, // Track current song by ID for idempotent operations
  // Playback state
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentTrack: null,
    lastUpdate: Date.now(),
  },
  // Settings
  settings: {
    allowAnyoneToAdd: true,
    maxQueueSize: 50,
  },
});

/**
 * Add song to queue with metadata
 */
const addToQueue = (group, song, addedBy) => {
  if (group.queue.length >= group.settings.maxQueueSize) {
    return { success: false, error: 'Queue is full' };
  }

  const queueItem = {
    id: generateQueueItemId(),
    song,
    addedBy: {
      userId: addedBy.userId,
      userName: addedBy.userName,
      profilePic: addedBy.profilePic,
    },
    addedAt: Date.now(),
    status: 'pending',
  };

  group.queue.push(queueItem);

  // If nothing is playing, start this song
  const shouldAutoPlay = group.currentQueueIndex === -1;
  if (shouldAutoPlay) {
    group.currentQueueIndex = 0;
    group.currentSongId = queueItem.id; // Track current song by ID
    queueItem.status = 'playing';
    group.playbackState.currentTrack = song;
    group.playbackState.currentTime = 0;
    group.playbackState.isPlaying = true;
    group.playbackState.lastUpdate = Date.now();
  }

  return { success: true, queueItem, autoPlay: shouldAutoPlay };
};

/**
 * Remove song from queue
 */
const removeFromQueue = (group, queueItemId, userId) => {
  const index = group.queue.findIndex((item) => item.id === queueItemId);
  if (index === -1) {
    return { success: false, error: 'Item not found' };
  }

  const item = group.queue[index];

  // Only allow removal by the person who added it or group creator
  if (item.addedBy.userId !== userId && group.createdBy !== userId) {
    return { success: false, error: 'Not authorized' };
  }

  // Can't remove currently playing song (use skip instead)
  if (index === group.currentQueueIndex) {
    return { success: false, error: 'Cannot remove currently playing song. Use skip instead.' };
  }

  group.queue.splice(index, 1);

  // Adjust currentQueueIndex if needed
  if (index < group.currentQueueIndex) {
    group.currentQueueIndex--;
  }

  return { success: true };
};

/**
 * Skip to next song in queue (idempotent - checks current song status)
 * @param {object} group - The group object
 * @param {string} expectedSongId - Optional: only skip if this song is currently playing (for song-ended idempotency)
 */
const skipToNext = (group, expectedSongId = null) => {
  if (group.queue.length === 0) {
    return { success: false, error: 'Queue is empty' };
  }

  // Idempotency check: if expectedSongId is provided, only skip if it matches current
  if (expectedSongId && group.currentSongId !== expectedSongId) {
    // Already advanced past this song, ignore duplicate request
    return { success: false, error: 'Song already advanced', alreadyAdvanced: true };
  }

  // If no current song playing (index -1), start from beginning
  if (group.currentQueueIndex === -1) {
    if (group.queue.length > 0) {
      group.currentQueueIndex = 0;
      group.currentSongId = group.queue[0].id;
      group.queue[0].status = 'playing';
      group.playbackState.currentTrack = group.queue[0].song;
      group.playbackState.currentTime = 0;
      group.playbackState.isPlaying = true;
      group.playbackState.lastUpdate = Date.now();
      return { success: true, hasNext: true, currentItem: group.queue[0] };
    }
    return { success: false, error: 'Queue is empty' };
  }

  // Mark current as played (if valid)
  if (group.currentQueueIndex >= 0 && group.currentQueueIndex < group.queue.length) {
    const currentItem = group.queue[group.currentQueueIndex];
    // Idempotency: only mark as played if currently playing
    if (currentItem.status === 'playing') {
      currentItem.status = 'played';
    }
  }

  // Move to next
  const nextIndex = group.currentQueueIndex + 1;

  if (nextIndex >= group.queue.length) {
    // End of queue
    group.currentQueueIndex = -1;
    group.currentSongId = null;
    group.playbackState.currentTrack = null;
    group.playbackState.isPlaying = false;
    group.playbackState.currentTime = 0;
    return { success: true, hasNext: false };
  }

  // Advance to next song
  const nextItem = group.queue[nextIndex];
  group.currentQueueIndex = nextIndex;
  group.currentSongId = nextItem.id;
  nextItem.status = 'playing';
  group.playbackState.currentTrack = nextItem.song;
  group.playbackState.currentTime = 0;
  group.playbackState.isPlaying = true;
  group.playbackState.lastUpdate = Date.now();

  return {
    success: true,
    hasNext: true,
    currentItem: nextItem,
  };
};

/**
 * Reorder queue items
 */
const reorderQueue = (group, fromIndex, toIndex) => {
  // Can't move past currently playing song
  if (fromIndex <= group.currentQueueIndex || toIndex <= group.currentQueueIndex) {
    return { success: false, error: 'Cannot reorder played or currently playing songs' };
  }

  if (
    fromIndex < 0 ||
    fromIndex >= group.queue.length ||
    toIndex < 0 ||
    toIndex >= group.queue.length
  ) {
    return { success: false, error: 'Invalid index' };
  }

  const [item] = group.queue.splice(fromIndex, 1);
  group.queue.splice(toIndex, 0, item);

  return { success: true };
};

/**
 * Get current queue state for clients
 */
const getQueueState = (group) => ({
  queue: group.queue,
  currentQueueIndex: group.currentQueueIndex,
  currentSongId: group.currentSongId,
  currentItem: group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null,
});

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
    const newGroup = createGroupState({
      id: groupId,
      name: data.name,
      createdBy: data.createdBy,
      userName: data.userName,
      profilePic: data.profilePic,
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
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
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
        playbackState: { ...group.playbackState, serverTime: Date.now() },
        ...getQueueState(group),
      });
    } else {
      socket.emit('group-not-found');
    }
  });

  // Request sync state - provides full playback state for drift correction
  socket.on('request-sync', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      const currentItem =
        group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;

      socket.emit('sync-state', {
        playbackState: {
          ...group.playbackState,
          serverTime: Date.now(),
          // Include current track info for out-of-sync recovery
          currentTrack: currentItem?.song || null,
        },
        ...getQueueState(group),
        // Include song ID for verification
        currentSongId: group.currentSongId,
      });
    }
  });

  // ==================== QUEUE EVENTS ====================

  // Add song to queue
  socket.on('add-to-queue', (data) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    const result = addToQueue(group, song, addedBy);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'add',
        item: result.queueItem,
      });

      // Activity message
      emitActivityMessage(io, groupId, 'song-added', {
        userName: addedBy.userName,
        songName: song.name,
      });

      // If this is the first song, broadcast song change
      if (result.autoPlay && group.queue.length === 1) {
        io.to(`music-group-${groupId}`).emit('music-update', {
          song: result.queueItem.song,
          currentTime: 0,
          queueItem: result.queueItem,
        });

        emitActivityMessage(io, groupId, 'song-playing', {
          songName: song.name,
          addedBy: addedBy.userName,
        });
      }
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  // Remove song from queue
  socket.on('remove-from-queue', (data) => {
    const { groupId, queueItemId, userId } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    const result = removeFromQueue(group, queueItemId, userId);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'remove',
        removedId: queueItemId,
      });
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  // Skip to next song
  socket.on('skip-song', (data) => {
    const { groupId, userName } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    const result = skipToNext(group);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'skip',
      });

      // Activity message for skip
      emitActivityMessage(io, groupId, 'song-skipped', { userName });

      if (result.hasNext) {
        io.to(`music-group-${groupId}`).emit('music-update', {
          song: result.currentItem.song,
          currentTime: 0,
          queueItem: result.currentItem,
        });

        // Activity message for now playing
        emitActivityMessage(io, groupId, 'song-playing', {
          songName: result.currentItem.song.name,
          addedBy: result.currentItem.addedBy?.userName,
        });
      } else {
        io.to(`music-group-${groupId}`).emit('queue-ended');
        emitActivityMessage(io, groupId, 'queue-ended', {});
      }
    }
  });

  // Song ended - auto advance (idempotent via song ID check)
  socket.on('song-ended', (data) => {
    const { groupId, songId } = data; // songId is the queue item ID that ended
    const group = musicGroups.get(groupId);

    if (!group) return;

    // Use songId for idempotency - only advance if this song is still the current one
    const result = skipToNext(group, songId);

    // If already advanced (duplicate request), ignore silently
    if (result.alreadyAdvanced) {
      console.log(`Ignoring duplicate song-ended for song ${songId}`);
      return;
    }

    // Broadcast updated queue state
    io.to(`music-group-${groupId}`).emit('queue-updated', {
      ...getQueueState(group),
      action: 'song-ended',
    });

    if (result.success && result.hasNext) {
      io.to(`music-group-${groupId}`).emit('music-update', {
        song: result.currentItem.song,
        currentTime: 0,
        queueItem: result.currentItem,
        autoPlay: true,
      });

      // Activity message for next song
      emitActivityMessage(io, groupId, 'song-playing', {
        songName: result.currentItem.song.name,
        addedBy: result.currentItem.addedBy?.userName,
      });
    } else if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-ended');
      emitActivityMessage(io, groupId, 'queue-ended', {});
    }
  });

  // Reorder queue
  socket.on('reorder-queue', (data) => {
    const { groupId, fromIndex, toIndex } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    const result = reorderQueue(group, fromIndex, toIndex);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'reorder',
      });
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  // ==================== PLAYBACK EVENTS ====================

  // Change the current song (direct play without queue)
  socket.on('music-change', (data) => {
    const { groupId, song, currentTime, scheduledTime, addedBy } = data;
    const group = musicGroups.get(groupId);

    if (!group) return;

    // Add to queue and play immediately
    const queueItem = {
      id: generateQueueItemId(),
      song,
      addedBy: addedBy || { userId: 'unknown', userName: 'Unknown', profilePic: '' },
      addedAt: Date.now(),
      status: 'playing',
    };

    // Mark all current as played
    group.queue.forEach((item, idx) => {
      if (idx <= group.currentQueueIndex) {
        item.status = 'played';
      }
    });

    // Insert at current position + 1 or at 0 if empty
    const insertIndex = group.currentQueueIndex >= 0 ? group.currentQueueIndex + 1 : 0;
    group.queue.splice(insertIndex, 0, queueItem);
    group.currentQueueIndex = insertIndex;

    group.playbackState = {
      ...group.playbackState,
      currentTime,
      currentTrack: song,
      isPlaying: false,
      lastUpdate: Date.now(),
    };

    socket.to(`music-group-${groupId}`).emit('music-update', {
      song,
      currentTime,
      scheduledTime,
      queueItem,
    });

    io.to(`music-group-${groupId}`).emit('queue-updated', {
      ...getQueueState(group),
      action: 'play-now',
    });
  });

  // Update playback state (play/pause)
  socket.on('music-playback', (data) => {
    const group = musicGroups.get(data.groupId);

    if (group) {
      group.playbackState = {
        ...group.playbackState,
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
 * Handle user disconnect with grace period
 */
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
            io.to(`music-group-${groupId}`).emit('member-left', { userId });

            if (group.members.length === 0) {
              musicGroups.delete(groupId);
            }
          }
        });

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
