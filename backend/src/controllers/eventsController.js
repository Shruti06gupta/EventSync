const mongoose = require('mongoose');
const Event = require('../models/Event');
const { safeCreateEventNotifications } = require('../services/notificationService');

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const geocodeLocation = async (locationName) => {
  if (!locationName || !locationName.trim()) {
    return null;
  }

  const query = encodeURIComponent(locationName.trim());
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EventSync/1.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to resolve this location.');
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const match = results[0];
  return {
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    displayName: match.display_name || locationName.trim(),
  };
};

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
    const locationName = req.query.locationName?.trim();
    const radiusKm = Number(req.query.radiusKm) || 100;
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const locationSearchActive = Boolean(locationName || (Number.isFinite(latitude) && Number.isFinite(longitude)));

    let resolvedLocation = null;
    if (locationSearchActive) {
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        resolvedLocation = { latitude, longitude };
      } else {
        resolvedLocation = await geocodeLocation(locationName);
        if (!resolvedLocation) {
          return res.status(400).json({ message: 'Location not found. Try a city, area, or nearby landmark.' });
        }
      }
    }

    const filter = {
      isVerified: true,
      registrationDeadline: { $gte: threeDaysAgo },
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

    if (locationSearchActive) {
      const radiusInRadians = Math.min(Math.max(Number(radiusKm) || 100, 1), 5000) / 6378.1;
      filter.location = {
        $geoWithin: {
          $centerSphere: [[resolvedLocation.longitude, resolvedLocation.latitude], radiusInRadians],
        },
      };
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    let allEvents = await Event.find(filter).populate('createdBy', 'name email role college');

    if (locationSearchActive && resolvedLocation) {
      allEvents = allEvents
        .map((event) => {
          if (!event.location || !Array.isArray(event.location.coordinates) || event.location.coordinates.length < 2) {
            return null;
          }

          const [eventLongitude, eventLatitude] = event.location.coordinates;
          const distanceKm = haversineDistanceKm(
            Number(eventLatitude),
            Number(eventLongitude),
            Number(resolvedLocation.latitude),
            Number(resolvedLocation.longitude)
          );

          return {
            ...event.toObject(),
            distanceKm: Number(distanceKm.toFixed(1)),
          };
        })
        .filter(Boolean)
        .filter((event) => event.distanceKm <= (Number(radiusKm) || 100));
    }

    allEvents.sort((a, b) => {
      const aDeadline = new Date(a.registrationDeadline);
      const bDeadline = new Date(b.registrationDeadline);
      const aIsOpen = aDeadline >= now;
      const bIsOpen = bDeadline >= now;

      if (locationSearchActive) {
        const aDistance = Number(a.distanceKm ?? Number.MAX_SAFE_INTEGER);
        const bDistance = Number(b.distanceKm ?? Number.MAX_SAFE_INTEGER);

        if (aIsOpen && !bIsOpen) return -1;
        if (!aIsOpen && bIsOpen) return 1;

        if (aIsOpen && bIsOpen) {
          if (aDistance !== bDistance) return aDistance - bDistance;
          return aDeadline.getTime() - bDeadline.getTime();
        }

        if (!aIsOpen && !bIsOpen) {
          if (aDistance !== bDistance) return aDistance - bDistance;
          return bDeadline.getTime() - aDeadline.getTime();
        }

        return 0;
      }

      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      if (aIsOpen && bIsOpen) {
        return aDeadline.getTime() - bDeadline.getTime();
      }

      if (!aIsOpen && !bIsOpen) {
        return bDeadline.getTime() - aDeadline.getTime();
      }

      return 0;
    });

    const userCollege = req.user?.college;
    if (userCollege && !locationSearchActive) {
      allEvents.sort((a, b) => {
        const aMatches = a.college && a.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        const bMatches = b.college && b.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
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
      locationSearch: locationSearchActive
        ? {
            active: true,
            locationName: resolvedLocation?.displayName || locationName || 'Your location',
            radiusKm: Number(radiusKm) || 100,
            latitude: resolvedLocation?.latitude || null,
            longitude: resolvedLocation?.longitude || null,
          }
        : { active: false },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to fetch events',
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
