const mongoose = require('mongoose');
const Event = require('../models/Event');
const { safeCreateEventNotifications } = require('../services/notificationService');

const getEvents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const search = req.query.search?.trim();
    const category = req.query.category?.trim();
    const mode = req.query.mode?.trim();
    const college = req.query.college?.trim();
    const source = req.query.source?.trim().toLowerCase();

    // Updated filter: include events where registration deadline is within last 3 days
    const filter = {
      isVerified: true,
      registrationDeadline: { $gte: threeDaysAgo }
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

    // Fetch all matching events
    const allEvents = await Event.find(filter)
      .populate('createdBy', 'name email role college');

    // Sort events: open events first (by deadline ascending), then closed events (by deadline descending)
    allEvents.sort((a, b) => {
      const aDeadline = new Date(a.registrationDeadline);
      const bDeadline = new Date(b.registrationDeadline);
      const aIsOpen = aDeadline >= now;
      const bIsOpen = bDeadline >= now;

      // Open events come before closed events
      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      // Within open events: sort by deadline ascending (soonest deadline first)
      if (aIsOpen && bIsOpen) {
        return aDeadline.getTime() - bDeadline.getTime();
      }

      // Within closed events: sort by deadline descending (newest closed first)
      if (!aIsOpen && !bIsOpen) {
        return bDeadline.getTime() - aDeadline.getTime();
      }

      return 0;
    });

    // Sort by user's college first (preserve the main sort as much as possible)
    const userCollege = req.user?.college;
    if (userCollege) {
      allEvents.sort((a, b) => {
        const aMatches = a.college && a.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        const bMatches = b.college && b.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0; // Preserve the main open/closed sort order
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

    if (new Date(registrationDeadline) > new Date(startDate)) {
      return res.status(400).json({ message: 'Registration deadline cannot be after the event start date.' });
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

    await safeCreateEventNotifications({
      actorUserId: req.user._id,
      eventId: newEvent._id,
      eventTitle: newEvent.title,
      eventCategory: newEvent.category,
      eventTags: newEvent.tags,
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

    // Validate that the registration deadline is not after the event start date
    const effectiveStartDate = startDate !== undefined ? new Date(startDate) : new Date(event.startDate);
    const effectiveDeadline = registrationDeadline !== undefined ? new Date(registrationDeadline) : new Date(event.registrationDeadline);
    if (effectiveDeadline > effectiveStartDate) {
      return res.status(400).json({ message: 'Registration deadline cannot be after the event start date.' });
    }

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

const getEventTags = async (req, res) => {
  try {
    const categories = await Event.distinct('category', { isVerified: true });
    const tagsArrays = await Event.distinct('tags', { isVerified: true });
    
    const tagSet = new Set();
    categories.forEach(c => {
      if (c && c.trim()) tagSet.add(c.trim());
    });
    
    tagsArrays.forEach(tag => {
      if (tag && tag.trim()) tagSet.add(tag.trim());
    });

    const tags = Array.from(tagSet).sort();

    return res.status(200).json({
      message: 'Tags fetched successfully',
      tags,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch tags',
      error: error.message,
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  getEventTags,
};
