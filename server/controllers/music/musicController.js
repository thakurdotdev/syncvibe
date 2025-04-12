const { Sequelize } = require("sequelize");
const Playlist = require("../../models/music/playlist");
const PlaylistSong = require("../../models/music/playlistSong");
const sequelize = require("../../utils/sequelize");

const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.userid;
    const playlist = await Playlist.create({
      name,
      description,
      userId,
    });
    res.status(200).json({
      message: "Playlist created",
      data: playlist,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updatePlaylist = async (req, res) => {
  try {
    const { name, description, id } = req.body;
    const userId = req.user.userid;
    const playlist = await Playlist.findOne({
      where: { id, userId },
    });

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    await Playlist.update(
      { name, description },
      {
        where: { id },
      },
    );

    res.status(200).json({ message: "Playlist updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.body;
    const userId = req.user.userid;

    // Check if the playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Use a transaction to ensure atomicity of the operations
    await sequelize.transaction(async (transaction) => {
      // Delete associated playlist songs
      await PlaylistSong.destroy({
        where: { playlistId },
        transaction,
      });

      // Delete the playlist
      await Playlist.destroy({
        where: { id: playlistId },
        transaction,
      });
    });

    res.status(200).json({ message: "Playlist deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addSongToPlaylist = async (req, res) => {
  try {
    const { playlistId, songId, songData } = req.body;
    const userId = req.user.userid;
    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const alreadyAdded = await PlaylistSong.findOne({
      where: { playlistId, songId },
    });

    if (alreadyAdded) {
      return res.status(400).json({
        message: "Song already added to playlist",
      });
    }

    await PlaylistSong.create({ playlistId, songId, songData });

    res.status(201).json({ message: "Song added to playlist" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeSongFromPlaylist = async (req, res) => {
  try {
    const { playlistId, songId } = req.body;
    const userId = req.user.userid;
    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    await PlaylistSong.destroy({
      where: { playlistId, songId },
    });

    res.status(200).json({ message: "Song removed from playlist" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPlaylists = async (req, res) => {
  try {
    const userId = req.user.userid;

    if (!userId) {
      return res.status(400).json({ message: "Invalid user" });
    }

    // Optimized query with specific attributes and better join strategy
    const playlists = await Playlist.findAll({
      where: { userId },
      attributes: [
        "id",
        "name",
        "description",
        "createdat",
        [Sequelize.fn("COUNT", Sequelize.col("songs.id")), "songCount"],
      ],
      include: [
        {
          model: PlaylistSong,
          as: "songs",
          attributes: [],
          required: false, // LEFT JOIN instead of INNER JOIN
        },
        {
          model: PlaylistSong,
          as: "latestSong",
          attributes: ["songData"],
          required: false, // LEFT JOIN to ensure playlists with no songs still return
          order: [["createdat", "DESC"]],
          limit: 1,
          separate: true, // Use a separate query for better performance
        },
      ],
      group: ["Playlist.id"],
      order: [["createdat", "DESC"]], // Most recent playlists first
    });

    // Process results efficiently using map
    const updatedPlaylists = playlists.map((playlist) => {
      const latestSong = playlist.latestSong && playlist.latestSong[0];
      let image = null;

      // Try-catch for JSON parsing to prevent crashes
      if (latestSong) {
        try {
          const songData = JSON.parse(latestSong.songData);
          image = songData.image;
        } catch (e) {
          console.error("Error parsing song data:", e);
        }
      }

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        createdat: playlist.createdat,
        songCount: playlist.get("songCount"),
        image,
      };
    });

    res.status(200).json({
      message: "Playlists fetched",
      data: updatedPlaylists,
    });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: error.message });
  }
};

const getPlaylistSongs = async (req, res) => {
  try {
    const { id: playlistId } = req.query;
    const userId = req.user.userid;

    // Combined query to reduce database roundtrips
    const [playlist, songs] = await Promise.all([
      Playlist.findOne({
        where: { id: playlistId, userId },
        attributes: ["id", "name", "description", "createdat", "userId"],
        raw: true,
      }),
      PlaylistSong.findAll({
        where: { playlistId },
        order: [["createdat", "DESC"]],
        raw: true,
      }),
    ]);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    // Use map with JSON.parse wrapped in try-catch for safety
    const updatedSongs = songs.map((song) => {
      try {
        return {
          ...song,
          songData: JSON.parse(song.songData),
        };
      } catch (e) {
        console.error("Error parsing song data:", e);
        return {
          ...song,
          songData: { error: "Invalid song data" },
        };
      }
    });

    const playlistImage =
      updatedSongs.length > 0 ? updatedSongs[0].songData.image : null;

    res.status(200).json({
      message: "Playlist songs fetched",
      data: {
        ...playlist,
        image: playlistImage,
        songs: updatedSongs,
      },
    });
  } catch (error) {
    console.error("Error fetching playlist songs:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylists,
  getPlaylistSongs,
};
