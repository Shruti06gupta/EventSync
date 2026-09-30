const Event = require('../models/Event');

/**
 * Build MongoDB filter object from query parameters
 * @param {object} queryParams - Query parameters
 * @returns {object} MongoDB filter object
 */
const buildEventFilter = (queryParams) => {
  const {
    search,
    category,
    mode,
    college,
    source,
    locationName,
    startDate,
    endDate,
  } = queryParams;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

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

  // Location filter (venue field - text search)
  if (locationName) {
    filter.venue = { $regex: locationName, $options: 'i' };
  }

  // Date range filters
  // Events overlap with the requested range if: event.startDate <= requestedEndDate AND event.endDate >= requestedStartDate
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      // Set end of day for the end date
      end.setHours(23, 59, 59, 999);
      // Events that overlap with the requested date range
      andConditions.push({
        $and: [
          { startDate: { $lte: end } },
          { endDate: { $gte: start } },
        ],
      });
    }
  } else if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      // Events that start on or after the specified date
      filter.startDate = { $gte: start };
    }
  } else if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Set end of day for the end date
      end.setHours(23, 59, 59, 999);
      // Events that end on or before the specified date
      filter.endDate = { $lte: end };
    }
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  return filter;
};

/**
 * Query events with filters
 * @param {object} queryParams - Query parameters
 * @param {object} options - Query options
 * @param {number} options.limit - Maximum number of events to return
 * @param {number} options.skip - Number of events to skip
 * @returns {Promise<object>} Query result with events and metadata
 */
const queryEvents = async (queryParams, options = {}) => {
  const { limit = 10, skip = 0 } = options;

  try {
    const filter = buildEventFilter(queryParams);
    const events = await Event.find(filter)
      .populate('createdBy', 'name email role college')
      .skip(skip)
      .limit(limit);

    const totalEvents = await Event.countDocuments(filter);

    return {
      success: true,
      events,
      totalEvents,
      filter,
    };
  } catch (error) {
    console.error('[EventQueryService] Query failed:', error.message);
    return {
      success: false,
      error: error.message,
      events: [],
      totalEvents: 0,
    };
  }
};

/**
 * Sort events by registration deadline (upcoming first)
 * @param {Array} events - Array of event objects
 * @returns {Array} Sorted events
 */
const sortEventsByDeadline = (events) => {
  const now = new Date();

  return events.sort((a, b) => {
    const aDeadline = new Date(a.registrationDeadline);
    const bDeadline = new Date(b.registrationDeadline);
    const aIsOpen = aDeadline >= now;
    const bIsOpen = bDeadline >= now;

    // Open events first
    if (aIsOpen && !bIsOpen) return -1;
    if (!aIsOpen && bIsOpen) return 1;

    // Within open events, sort by deadline (earliest first)
    if (aIsOpen && bIsOpen) {
      return aDeadline.getTime() - bDeadline.getTime();
    }

    // Within closed events, sort by deadline (most recent first)
    if (!aIsOpen && !bIsOpen) {
      return bDeadline.getTime() - aDeadline.getTime();
    }

    return 0;
  });
};

module.exports = {
  buildEventFilter,
  queryEvents,
  sortEventsByDeadline,
};
