const express = require('express');
const { getTrending, search } = require('../controllers/gifController');

const gifRoutes = express.Router();

gifRoutes.get('/gifs/trending', getTrending);
gifRoutes.get('/gifs/search', search);

module.exports = gifRoutes;
