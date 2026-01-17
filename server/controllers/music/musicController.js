const { Sequelize } = require("sequelize")
const Playlist = require("../../models/music/playlist")
const PlaylistSong = require("../../models/music/playlistSong")
const Song = require("../../models/music/Song")
const sequelize = require("../../utils/sequelize")

// Initialize associations
require("../../models/music/index")

const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body
    const userId = req.user.userid
    const playlist = await Playlist.create({
      name,
      description,
      userId,
    })
    res.status(200).json({
      message: "Playlist created",
      data: playlist,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const updatePlaylist = async (req, res) => {
  try {
    const { name, description, id } = req.body
    const userId = req.user.userid
    const playlist = await Playlist.findOne({
      where: { id, userId },
    })

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" })
    }

    await Playlist.update(
      { name, description },
      {
        where: { id },
      },
    )

    res.status(200).json({ message: "Playlist updated" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.body
    const userId = req.user.userid

    // Check if the playlist exists and belongs to the user
    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    })

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Use a transaction to ensure atomicity of the operations
    await sequelize.transaction(async (transaction) => {
      // Delete associated playlist songs
      await PlaylistSong.destroy({
        where: { playlistId },
        transaction,
      })

      // Delete the playlist
      await Playlist.destroy({
        where: { id: playlistId },
        transaction,
      })
    })

    res.status(200).json({ message: "Playlist deleted" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const addSongToPlaylist = async (req, res) => {
  try {
    const { playlistId, songId, songData: rawSongData } = req.body
    const userId = req.user.userid

    // Parse songData if it's a string
    const songData = typeof rawSongData === "string" ? JSON.parse(rawSongData) : rawSongData

    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    })

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    // Get or create song in central table
    const song = await Song.getOrCreate(songData)

    const alreadyAdded = await PlaylistSong.findOne({
      where: { playlistId, songRefId: song.id },
    })

    if (alreadyAdded) {
      return res.status(400).json({
        message: "Song already added to playlist",
      })
    }

    await PlaylistSong.create({
      playlistId,
      songRefId: song.id,
      // Keep deprecated fields for backward compatibility
      songId,
      songData,
    })

    res.status(201).json({ message: "Song added to playlist" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const removeSongFromPlaylist = async (req, res) => {
  try {
    const { playlistId, songId } = req.body
    const userId = req.user.userid
    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
    })

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" })
    }

    await PlaylistSong.destroy({
      where: { playlistId, songId },
    })

    res.status(200).json({ message: "Song removed from playlist" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const getPlaylists = async (req, res) => {
  try {
    const userId = req.user.userid

    if (!userId) {
      return res.status(400).json({ message: "Invalid user" })
    }

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
        },
        {
          model: PlaylistSong,
          as: "latestSong",
          attributes: ["songData"],
          order: [["createdat", "DESC"]],
          limit: 1,
        },
      ],
      group: ["Playlist.id"],
    })

    const updatedPlaylists = playlists.map((playlist) => {
      const latestSong = playlist.latestSong && playlist.latestSong[0]
      const songData = latestSong ? latestSong.songData : null
      const parsedSongData = typeof songData === "string" ? JSON.parse(songData) : songData
      const image = parsedSongData ? parsedSongData.image : null

      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        createdat: playlist.createdat,
        songCount: playlist.get("songCount"),
        image,
      }
    })

    res.status(200).json({
      message: "Playlists fetched",
      data: updatedPlaylists,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const getPlaylistSongs = async (req, res) => {
  try {
    const { id: playlistId } = req.query
    const userId = req.user.userid

    const playlist = await Playlist.findOne({
      where: { id: playlistId, userId },
      raw: true,
    })

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" })
    }

    const songs = await PlaylistSong.findAll({
      where: { playlistId },
      include: [
        {
          model: Song,
          as: "song",
          attributes: ["songData"],
        },
      ],
      order: [["createdat", "DESC"]],
    })

    const updatedSongs = songs.map((playlistSong) => {
      // Prefer Song association, fall back to deprecated songData column
      const songData =
        playlistSong.song?.songData ||
        (typeof playlistSong.songData === "string"
          ? JSON.parse(playlistSong.songData)
          : playlistSong.songData)
      return {
        id: playlistSong.id,
        playlistId: playlistSong.playlistId,
        songRefId: playlistSong.songRefId,
        songData,
        createdat: playlistSong.createdat,
      }
    })

    const playlistImage = updatedSongs.length > 0 ? updatedSongs[0].songData?.image : null

    res.status(200).json({
      message: "Playlist songs fetched",
      data: {
        ...playlist,
        image: playlistImage,
        songs: updatedSongs,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylists,
  getPlaylistSongs,
}
