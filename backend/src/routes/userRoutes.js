const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { getProfile, updateProfile } = require('../controllers/userController');

const router = express.Router();

router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);

router.get('/admin-only', authMiddleware, roleMiddleware('admin'), (req, res) => {
  res.status(200).json({ message: 'Admin access granted' });
});

module.exports = router;