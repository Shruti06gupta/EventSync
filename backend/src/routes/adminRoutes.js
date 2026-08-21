const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { getDashboardStats, getUsers, getReports, exportReports } = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard/stats', authMiddleware, roleMiddleware('admin'), getDashboardStats);
router.get('/users', authMiddleware, roleMiddleware('admin'), getUsers);
router.get('/reports', authMiddleware, roleMiddleware('admin'), getReports);
router.get('/reports/export', authMiddleware, roleMiddleware('admin'), exportReports);

module.exports = router;
