const express = require('express');
const { triggerSync, getSyncStatus } = require('../controllers/aggregation.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/sync', authMiddleware, roleMiddleware('admin'), triggerSync);
router.get('/status', authMiddleware, roleMiddleware('admin'), getSyncStatus);

module.exports = router;
