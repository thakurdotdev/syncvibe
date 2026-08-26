const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createChat } = require('../controllers/chat/createChat');
const { deleteMessage } = require('../controllers/chat/createMessage');
const { getAllMessages } = require('../controllers/chat/getAllMessages');
const getChatList = require('../controllers/chat/getChatList');

const chatRoutes = express.Router();

//Create chat and add to db
chatRoutes.route('/create/chat').post(authMiddleware, createChat);

chatRoutes.route('/get/chatlist').get(authMiddleware, getChatList);

chatRoutes.route('/delete/message/:messageid').delete(authMiddleware, deleteMessage);

chatRoutes.route('/get/messages/:chatid').get(authMiddleware, getAllMessages);

module.exports = chatRoutes;
