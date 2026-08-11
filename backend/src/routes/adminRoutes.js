const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { getDashboardStats } = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard/stats', authMiddleware, roleMiddleware('admin'), getDashboardStats);

module.exports = router;
