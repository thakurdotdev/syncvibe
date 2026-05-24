const { GroupSessionHistory, Song } = require("../../models/music");
const User = require("../../models/auth/userModel");
const { Op } = require("sequelize");

const getLastSessionSongs = async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const latestEntry = await GroupSessionHistory.findOne({
      where: { addedByUserId: userId },
      order: [["playedAt", "DESC"]],
      attributes: ["sessionId"],
      raw: true,
    });

    if (!latestEntry) {
      return res.json({ success: true, data: [] });
    }

    const songs = await GroupSessionHistory.findAll({
      where: { sessionId: latestEntry.sessionId },
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
