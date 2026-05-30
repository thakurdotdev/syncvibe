const { GroupSessionHistory, Song } = require("../../models/music");
const User = require("../../models/auth/userModel");
const GroupInvite = require("../../models/music/groupInviteModel");
const { Op } = require("sequelize");

const getLastSessionSongs = async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    // 1. Get latest session where the user added a song
    const latestAddedEntry = await GroupSessionHistory.findOne({
      where: { addedByUserId: userId },
      order: [["playedAt", "DESC"]],
      attributes: ["sessionId", "playedAt"],
      raw: true,
    });

    // 2. Get latest group invite where the user participated
    const latestInvite = await GroupInvite.findOne({
      where: {
        [Op.or]: [
          { inviterId: userId },
          { inviteeId: userId, status: "accepted" }
        ]
      },
      order: [["updatedAt", "DESC"]],
      attributes: ["groupId", "updatedAt"],
      raw: true,
    });

    // Determine the active sessionId
    let targetSessionId = null;
    if (latestAddedEntry && latestInvite) {
      const addedTime = new Date(latestAddedEntry.playedAt).getTime();
      const inviteTime = new Date(latestInvite.updatedAt).getTime();
      targetSessionId = addedTime >= inviteTime ? latestAddedEntry.sessionId : latestInvite.groupId;
    } else if (latestAddedEntry) {
      targetSessionId = latestAddedEntry.sessionId;
    } else if (latestInvite) {
      targetSessionId = latestInvite.groupId;
    }

    if (!targetSessionId) {
      return res.json({ success: true, data: [] });
    }

    const songs = await GroupSessionHistory.findAll({
      where: { sessionId: targetSessionId },
      include: [
        {
          model: Song,
          as: "song",
          attributes: ["songId", "name", "artistNames", "songData"],
        },
        {
          model: User,
          as: "addedBy",
          attributes: ["userid", "name", "profilepic"],
        },
      ],
      order: [["playedAt", "ASC"]],
      limit: 50,
    });

    const result = songs.map((entry) => ({
      id: entry.song?.songData?.id || entry.song?.songId,
      name: entry.song?.name,
      artist: entry.song?.artistNames,
      songData: entry.song?.songData,
      addedBy: entry.addedBy
        ? { userId: entry.addedBy.userid, name: entry.addedBy.name, profilePic: entry.addedBy.profilepic }
        : null,
      playedAt: entry.playedAt,
      reactionCount: entry.reactionCount,
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("[GroupHistory] Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getLastSessionSongs };
