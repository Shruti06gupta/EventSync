const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { getEvents, getEventById, createEvent, updateEvent, getEventTags } = require('../controllers/eventsController');
const { getRecommendedEvents } = require('../controllers/recommendationsController');

const router = express.Router();

router.get('/', authMiddleware, getEvents);
router.get('/tags', getEventTags);
router.get('/recommended', authMiddleware, getRecommendedEvents);
router.get('/:id', authMiddleware, getEventById);
router.post('/', authMiddleware, roleMiddleware('admin'), createEvent);
router.patch('/:id', authMiddleware, roleMiddleware('admin'), updateEvent);

module.exports = router;
