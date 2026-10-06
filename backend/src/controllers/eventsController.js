const mongoose = require('mongoose');
const Event = require('../models/Event');
const { safeCreateEventNotifications } = require('../services/notificationService');
const { geocodeLocation, isValidCoordinate } = require('../utils/geocoder');

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
    const radiusKm = Math.min(Math.max(Number(req.query.radiusKm) || 100, 1), 5000);
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    // Determine search mode
    const hasCoordinates = isValidCoordinate(latitude, longitude);
    const hasLocationName = Boolean(locationName);
    const locationSearchActive = hasCoordinates || hasLocationName;

    let resolvedLocation = null;
    let usedGeospatialSearch = false;
    let usedTextSearch = false;

    // Resolve location for search
    if (locationSearchActive) {
      if (hasCoordinates) {
        // Mode 1: Geographic radius search with provided coordinates
        resolvedLocation = { latitude, longitude };
        usedGeospatialSearch = true;
      } else if (hasLocationName) {
        // Mode 2: Try to geocode the location name
        resolvedLocation = await geocodeLocation(locationName);
        if (resolvedLocation) {
          // Geocoding succeeded - fall back to geographic radius search
          usedGeospatialSearch = true;
        } else {
          // Geocoding failed - fall back to text-based venue search
          usedTextSearch = true;
        }
      }
    }

    // Build base filter
    const filter = {
      isVerified: true,
      registrationDeadline: { $gte: threeDaysAgo },
    };

    const andConditions = [];

    // Search filter
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

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Mode filter
    if (mode) {
      filter.mode = mode;
    }

    // College filter
    if (college) {
      filter.college = { $regex: college, $options: 'i' };
    }

    // Source filter
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

    // Location filter
    if (locationSearchActive) {
      if (usedGeospatialSearch && resolvedLocation) {
        // Geographic radius search using $near
        // $near automatically sorts by distance and enforces maxDistance
        filter.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [resolvedLocation.longitude, resolvedLocation.latitude],
            },
            $maxDistance: radiusKm * 1000, // Convert km to meters
          },
        };
      } else if (usedTextSearch && locationName) {
        // Text-based venue search fallback
        andConditions.push({
          $or: [
            { venue: { $regex: locationName, $options: 'i' } },
            { locationName: { $regex: locationName, $options: 'i' } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Execute query
    let query = Event.find(filter).populate('createdBy', 'name email role college');

    // For geospatial search, MongoDB automatically sorts by distance
    // For text search, we'll need to sort later
    let allEvents = await query;

    // Calculate distances for geospatial search results
    if (usedGeospatialSearch && resolvedLocation) {
      allEvents = allEvents.map((event) => {
        if (!event.location || !Array.isArray(event.location.coordinates) || event.location.coordinates.length < 2) {
          return null;
        }

        const [eventLongitude, eventLatitude] = event.location.coordinates;
        const distanceKm = calculateDistanceKm(
          resolvedLocation.latitude,
          resolvedLocation.longitude,
          eventLatitude,
          eventLongitude
        );

        return {
          ...event.toObject(),
          distanceKm: Number(distanceKm.toFixed(1)),
        };
      }).filter(Boolean);
    }

    // Sort events
    allEvents.sort((a, b) => {
      const aDeadline = new Date(a.registrationDeadline);
      const bDeadline = new Date(b.registrationDeadline);
      const aIsOpen = aDeadline >= now;
      const bIsOpen = bDeadline >= now;

      if (usedGeospatialSearch) {
        // For geospatial search, sort by distance first, then deadline
        const aDistance = Number(a.distanceKm ?? Number.MAX_SAFE_INTEGER);
        const bDistance = Number(b.distanceKm ?? Number.MAX_SAFE_INTEGER);

        if (aDistance !== bDistance) return aDistance - bDistance;

        // Same distance: prioritize open events
        if (aIsOpen && !bIsOpen) return -1;
        if (!aIsOpen && bIsOpen) return 1;

        // Both open or both closed: sort by deadline
        if (aIsOpen && bIsOpen) {
          return aDeadline.getTime() - bDeadline.getTime();
        }
        if (!aIsOpen && !bIsOpen) {
          return bDeadline.getTime() - aDeadline.getTime();
        }
      } else {
        // For non-geospatial search, prioritize open events, then deadline
        if (aIsOpen && !bIsOpen) return -1;
        if (!aIsOpen && bIsOpen) return 1;

        if (aIsOpen && bIsOpen) {
          return aDeadline.getTime() - bDeadline.getTime();
        }
        if (!aIsOpen && !bIsOpen) {
          return bDeadline.getTime() - aDeadline.getTime();
        }
      }

      return 0;
    });

    // Boost user's college events (only for non-geospatial search)
    const userCollege = req.user?.college;
    if (userCollege && !usedGeospatialSearch) {
      allEvents.sort((a, b) => {
        const aMatches = a.college && a.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        const bMatches = b.college && b.college.trim().toLowerCase() === userCollege.trim().toLowerCase();
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }

    // Pagination
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
            searchMode: usedGeospatialSearch ? 'geospatial' : 'text',
            locationName: resolvedLocation?.displayName || locationName || 'Your location',
            radiusKm: usedGeospatialSearch ? radiusKm : null,
            latitude: usedGeospatialSearch && resolvedLocation ? resolvedLocation.latitude : null,
            longitude: usedGeospatialSearch && resolvedLocation ? resolvedLocation.longitude : null,
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

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
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
      latitude,
      longitude,
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

    // Validate coordinates if provided
    let location = null;
    if (latitude !== undefined || longitude !== undefined) {
      if (!isValidCoordinate(Number(latitude), Number(longitude))) {
        return res.status(400).json({
          message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude must be between -180 and 180.',
        });
      }
      location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
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
      location,
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

    // Only the creator of the event or an admin can edit it
    if (
      req.user.role !== 'admin' &&
      (!event.createdBy || event.createdBy.toString() !== req.user._id.toString())
    ) {
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
