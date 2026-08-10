const express = require('express');
const { triggerSync } = require('../controllers/aggregation.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/sync', authMiddleware, roleMiddleware('admin'), triggerSync);

module.exports = router;
