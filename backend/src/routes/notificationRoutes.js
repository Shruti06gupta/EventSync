const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getNotifications,
  markNotificationAsRead,
} = require('../controllers/notificationsController');

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, markNotificationAsRead);

module.exports = router;
