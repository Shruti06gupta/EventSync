const mongoose = require('mongoose');
const Event = require('../models/Event');
const { createEventNotifications } = require('../services/notificationService');

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
    const source = req.query.source?.trim().toLowerCase();

    const filter = {
      isVerified: true,
      $or: [
        { startDate: { $gte: now } },
        { registrationDeadline: { $gte: now } }
      ]
    };

    const andConditions = [];

    if (search) {
      andConditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { organizer: { $regex: search, $options: 'i' } },
          { college: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
        ],
      });
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

    if (['devfolio', 'unstop', 'manual'].includes(source)) {
      if (source === 'manual') {
        filter.source = 'manual';
        filter.isAggregated = false;
      } else {
        andConditions.push({
          $or: [
            { source },
            { tags: source },
            { tags: { $in: [source] } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Fetch all matching events, sort by user's college first in memory, and then paginate
    const allEvents = await Event.find(filter)
      .sort({ registrationDeadline: 1, startDate: 1, createdAt: -1 })
      .populate('createdBy', 'name email role college');

    // Sort by user's college first
    const userCollege = req.user?.college;
    if (userCollege) {
      allEvents.sort((a, b) => {
        const aMatches = a.college && a.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        const bMatches = b.college && b.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0; // Preserve secondary sort order from DB
      });
    }

    const totalEvents = allEvents.length;
    const events = allEvents.slice(skip, skip + limit);
    const categories = await Event.distinct('category', { isVerified: true });

    return res.status(200).json({
      message: 'Events fetched successfully',
      events,
      categories,
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
        source: source || '',
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

const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      organizer,
      college,
      category,
      tags,
      startDate,
      endDate,
      registrationDeadline,
      mode,
      venue,
      image,
      eventLink,
      isPublic,
    } = req.body;

    if (!title || !description || !organizer || !college || !category || !startDate || !endDate || !registrationDeadline || !mode) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (eventLink) {
      try {
        const parsed = new URL(eventLink);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ message: 'Event link must start with http:// or https://' });
        }
      } catch (e) {
        return res.status(400).json({ message: 'Invalid Event Link URL format' });
      }
    }

    const newEvent = new Event({
      title,
      description,
      organizer,
      college,
      category,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      source: 'manual',
      startDate,
      endDate,
      registrationDeadline,
      mode,
      venue: mode === 'Online' ? 'Zoom/Online' : (venue || ''),
      image: image || '',
      eventLink: eventLink || '',
      isVerified: true,
      isPublic: isPublic === true || isPublic === 'true',
      createdBy: req.user._id,
    });

    await newEvent.save();

    await createEventNotifications({
      actorUserId: req.user._id,
      eventId: newEvent._id,
      eventTitle: newEvent.title,
      eventCategory: newEvent.category,
      eventCollege: newEvent.college,
      isPublic: newEvent.isPublic,
    });

    return res.status(201).json({
      message: 'Event created successfully',
      event: newEvent,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create event',
      error: error.message,
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Only the creator of the event can edit it
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this event' });
    }

    const {
      title,
      description,
      organizer,
      college,
      category,
      tags,
      startDate,
      endDate,
      registrationDeadline,
      mode,
      venue,
      image,
      eventLink,
    } = req.body;

    if (eventLink) {
      try {
        const parsed = new URL(eventLink);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ message: 'Event link must start with http:// or https://' });
        }
      } catch (e) {
        return res.status(400).json({ message: 'Invalid Event Link URL format' });
      }
    }

    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (organizer !== undefined) event.organizer = organizer;
    if (college !== undefined) event.college = college;
    if (category !== undefined) event.category = category;
    if (tags !== undefined) {
      event.tags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    }
    if (event.source === undefined) {
      event.source = 'manual';
    }
    if (startDate !== undefined) event.startDate = startDate;
    if (endDate !== undefined) event.endDate = endDate;
    if (registrationDeadline !== undefined) event.registrationDeadline = registrationDeadline;
    if (mode !== undefined) {
      event.mode = mode;
      if (mode === 'Online') {
        event.venue = 'Zoom/Online';
      } else if (venue !== undefined) {
        event.venue = venue;
      }
    } else if (venue !== undefined) {
      event.venue = venue;
    }
    if (image !== undefined) event.image = image;
    if (eventLink !== undefined) event.eventLink = eventLink;

    await event.save();
    return res.status(200).json({
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update event',
      error: error.message,
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
};