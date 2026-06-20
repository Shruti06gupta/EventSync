const mongoose = require('mongoose');
const Event = require('../models/Event');

const getEvents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const now = new Date();
    const search = req.query.search?.trim();
    const category = req.query.category?.trim();
    const mode = req.query.mode?.trim();
    const college = req.query.college?.trim();

    const filter = {
      isVerified: true,
      startDate: { $gte: now },
    };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { organizer: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (mode) {
      filter.mode = mode;
    }

    if (college) {
      filter.college = { $regex: college, $options: 'i' };
    }

    const [events, totalEvents] = await Promise.all([
      Event.find(filter)
        .sort({ registrationDeadline: 1, startDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email role college'),
      Event.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: 'Events fetched successfully',
      events,
      pagination: {
        page,
        limit,
        totalEvents,
        totalPages: Math.ceil(totalEvents / limit),
        hasNextPage: page * limit < totalEvents,
        hasPrevPage: page > 1,
      },
      filters: {
        search: search || '',
        category: category || '',
        mode: mode || '',
        college: college || '',
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch events',
      error: error.message,
    });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findOne({
      _id: id,
      isVerified: true,
      startDate: { $gte: new Date() },
    }).populate('createdBy', 'name email role college');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.status(200).json({
      message: 'Event fetched successfully',
      event,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch event',
      error: error.message,
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
};