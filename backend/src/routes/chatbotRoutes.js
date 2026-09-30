const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { handleChatMessage } = require('../controllers/chatbotController');

const router = express.Router();

router.post('/', authMiddleware, handleChatMessage);

module.exports = router;
