const Music = require("../../models/Story/music")

const getLatestMusic = async (req, res) => {
  try {
    const { limit, page, searchQuery } = req.query
    const offset = page - 1 * limit

    const where = {}

    if (searchQuery) {
      where.title = {
        [Op.iLike]: `%${searchQuery}%`,
      }
    }

    const music = await Music.findAndCountAll({
      where: where,
      limit: limit,
      offset: offset,
      order: [["postedtime", "DESC"]],
    })

    res.status(200).json(music)
  } catch (err) {
    res.status(500).json(err)
  }
}

module.exports = {
  getLatestMusic,
}
