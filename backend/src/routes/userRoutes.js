const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { getProfile, updateProfile, getNotificationPreferences, updateNotificationPreferences } = require('../controllers/userController');
const {
  getBookmarkIds,
  getBookmarks,
  addBookmark,
  removeBookmark,
} = require('../controllers/bookmarksController');

const router = express.Router();

router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);

router.get('/notification-preferences', authMiddleware, getNotificationPreferences);
router.patch('/notification-preferences', authMiddleware, updateNotificationPreferences);

router.get('/bookmarks/ids', authMiddleware, getBookmarkIds);
router.get('/bookmarks', authMiddleware, getBookmarks);
router.post('/bookmarks/:eventId', authMiddleware, addBookmark);
router.delete('/bookmarks/:eventId', authMiddleware, removeBookmark);

router.get('/admin-only', authMiddleware, roleMiddleware('admin'), (req, res) => {
  res.status(200).json({ message: 'Admin access granted' });
});

module.exports = router;