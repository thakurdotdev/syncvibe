const { getTrendingGifs, searchGifs } = require('../services/klipyService');

const getTrending = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const data = await getTrendingGifs(page, perPage);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to get trending GIFs:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch trending GIFs', data: [] });
  }
};

const search = async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

    if (!query.trim()) {
      const data = await getTrendingGifs(page, perPage);
      return res.json({ success: true, data });
    }

    const data = await searchGifs(query, page, perPage);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to search GIFs:', error.message);
    res.status(500).json({ success: false, message: 'Failed to search GIFs', data: [] });
  }
};

module.exports = {
  getTrending,
  search,
};
