const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getNotifications,
  markNotificationAsRead,
  clearAllNotifications,
} = require('../controllers/notificationsController');

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, markNotificationAsRead);
router.delete('/', authMiddleware, clearAllNotifications);

module.exports = router;
