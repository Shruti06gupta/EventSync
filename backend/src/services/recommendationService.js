const User = require('../models/User');
const Event = require('../models/Event');
const {
  rankEventsForUser,
  calculateEventRelevance,
  calculateHaversineKm,
} = require('./recommendationScoringService');

/**
 * Escapes regex special characters to prevent ReDoS
 * @param {string} str 
 * @returns {string}
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deduplicates events based on unique _id and normalized title + organizer
 * @param {Array} events 
 * @returns {Array}
 */
function deduplicateEvents(events) {
  if (!Array.isArray(events)) return [];

  const seenIds = new Set();
  const seenKeys = new Set();
  const unique = [];

  for (const ev of events) {
    if (!ev) continue;
    const id = ev._id ? String(ev._id) : (ev.id ? String(ev.id) : null);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const titleNorm = typeof ev.title === 'string' ? ev.title.trim().toLowerCase() : '';
    const orgNorm = typeof ev.organizer === 'string' ? ev.organizer.trim().toLowerCase() : '';
    const key = `${titleNorm}:::${orgNorm}`;

    if (titleNorm && seenKeys.has(key)) {
      continue;
    }
    if (titleNorm) {
      seenKeys.add(key);
    }

    unique.push(ev);
  }

  return unique;
}

/**
 * Common projection for event cards
 */
const EVENT_PROJECTION = {
  title: 1,
  description: 1,
  organizer: 1,
  college: 1,
  category: 1,
  tags: 1,
  source: 1,
  startDate: 1,
  endDate: 1,
  registrationDeadline: 1,
  mode: 1,
  venue: 1,
  locationName: 1,
  location: 1,
  image: 1,
  eventLink: 1,
  isPublic: 1,
  isVerified: 1,
  createdAt: 1,
};

/**
 * Resolves authenticated user profile with populated bookmark topics
 * @param {string|object} userOrId 
 * @returns {Promise<object|null>}
 */
async function resolveUserProfile(userOrId) {
  if (!userOrId) return null;

  if (typeof userOrId === 'object' && userOrId._id && Array.isArray(userOrId.interests)) {
    const needsPopulate = Array.isArray(userOrId.bookmarks) &&
      userOrId.bookmarks.length > 0 &&
      (typeof userOrId.bookmarks[0] === 'string' ||
        (typeof userOrId.bookmarks[0] === 'object' && !userOrId.bookmarks[0].category && !userOrId.bookmarks[0].tags));

    if (!needsPopulate) {
      return userOrId;
    }

    return User.findById(userOrId._id)
      .select('name email college interests bookmarks role')
      .populate('bookmarks', 'category tags title college')
      .lean();
  }

  const userId = userOrId?._id || userOrId;
  return User.findById(userId)
    .select('name email college interests bookmarks role')
    .populate('bookmarks', 'category tags title college')
    .lean();
}

/**
 * Category 1: For You (Personalized Relevance Scoring)
 */
async function getForYouEvents(user, queryParams = {}) {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 12, 1), 50);
  const now = queryParams.now instanceof Date ? queryParams.now : new Date();

  const filter = {
    isVerified: true,
    $or: [
      { registrationDeadline: { $gte: now } },
      { registrationDeadline: null, startDate: { $gte: now } },
    ],
  };

  const andConditions = [];

  if (queryParams.category && typeof queryParams.category === 'string') {
    const cat = queryParams.category.trim();
    if (cat) filter.category = new RegExp(`^${escapeRegex(cat)}$`, 'i');
  }

  if (queryParams.mode && typeof queryParams.mode === 'string') {
    const mode = queryParams.mode.trim();
    if (mode) filter.mode = new RegExp(`^${escapeRegex(mode)}$`, 'i');
  }

  if (queryParams.search && typeof queryParams.search === 'string') {
    const term = queryParams.search.trim();
    if (term) {
      const escaped = escapeRegex(term);
      andConditions.push({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { organizer: { $regex: escaped, $options: 'i' } },
          { college: { $regex: escaped, $options: 'i' } },
          { tags: { $in: [new RegExp(escaped, 'i')] } },
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const rawEvents = await Event.find(filter, EVENT_PROJECTION).lean();
  const eligibleEvents = deduplicateEvents(rawEvents);

  const userProfile = {
    interests: user.interests || [],
    college: user.college || '',
    bookmarks: user.bookmarks || [],
    skills: user.skills || [],
  };

  const rankedData = rankEventsForUser(eligibleEvents, userProfile, { now, excludeExpired: true });

  const totalEvents = rankedData.results.length;
  const totalPages = Math.ceil(totalEvents / limit) || 1;
  const skip = (page - 1) * limit;
  const paginatedRecommendations = rankedData.results.slice(skip, skip + limit);

  return {
    success: true,
    type: 'for-you',
    recommendations: paginatedRecommendations,
    events: paginatedRecommendations.map((r) => ({
      ...r.event,
      matchScore: r.matchPercentage,
      matchReason: r.explanation,
      score: r.score,
      isPersonalized: r.isPersonalized,
      isColdStart: r.isColdStart,
    })),
    pagination: {
      page,
      limit,
      totalEvents,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    isColdStart: rankedData.isColdStart,
    filters: {
      category: queryParams.category || '',
      search: queryParams.search || '',
      mode: queryParams.mode || '',
    },
  };
}

/**
 * Category 2: Trending Events
 * 
 * Uses genuine user engagement data (aggregated bookmarks per event from User.bookmarks),
 * combined with deadline urgency and creation recency. If no engagement data exists,
 * uses a transparent upcoming-event fallback sorted by deadline without fabricating numbers.
 */
async function getTrendingEvents(queryParams = {}) {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 12, 1), 50);
  const now = queryParams.now instanceof Date ? queryParams.now : new Date();

  // 1. Fetch eligible active verified events
  const filter = {
    isVerified: true,
    $or: [
      { registrationDeadline: { $gte: now } },
      { registrationDeadline: null, startDate: { $gte: now } },
    ],
  };

  if (queryParams.category) {
    filter.category = new RegExp(`^${escapeRegex(queryParams.category.trim())}$`, 'i');
  }

  const rawEvents = await Event.find(filter, EVENT_PROJECTION).lean();
  const eligibleEvents = deduplicateEvents(rawEvents);

  // 2. Aggregate genuine bookmark engagement per event
  // Uses $setUnion to ensure repeated saves by the same user cannot inflate counts
  let bookmarkCountsMap = new Map();
  try {
    const bookmarkCountsRaw = await User.aggregate([
      { $match: { bookmarks: { $exists: true, $ne: [] } } },
      { $project: { uniqueBookmarks: { $setUnion: ['$bookmarks', []] } } },
      { $unwind: '$uniqueBookmarks' },
      { $group: { _id: '$uniqueBookmarks', count: { $sum: 1 } } },
    ]);

    for (const item of bookmarkCountsRaw) {
      if (item && item._id) {
        bookmarkCountsMap.set(String(item._id), Number(item.count) || 0);
      }
    }
  } catch (err) {
    console.warn('[RecommendationService] Could not aggregate bookmark counts, using fallback:', err.message);
  }

  const hasEngagementData = bookmarkCountsMap.size > 0 && Array.from(bookmarkCountsMap.values()).some((c) => c > 0);

  // 3. Compute deterministic trending score for each event
  const scoredTrending = eligibleEvents.map((event) => {
    const id = String(event._id);
    const bookmarkCount = bookmarkCountsMap.get(id) || 0;

    // Urgency bonus: events closing in <= 3 days (5 pts), <= 7 days (3 pts), <= 14 days (1 pt)
    let urgencyBonus = 0;
    if (event.registrationDeadline) {
      const daysLeft = (new Date(event.registrationDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 3 && daysLeft >= 0) urgencyBonus = 5;
      else if (daysLeft <= 7 && daysLeft > 0) urgencyBonus = 3;
      else if (daysLeft <= 14 && daysLeft > 0) urgencyBonus = 1;
    }

    // Recency bonus: events created within the last 7 days (2 pts)
    let recencyBonus = 0;
    if (event.createdAt) {
      const daysOld = (now.getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld <= 7) recencyBonus = 2;
    }

    const trendingScore = bookmarkCount * 10 + urgencyBonus + recencyBonus;
    const isTrending = bookmarkCount > 0;

    let explanation = '';
    if (bookmarkCount > 0) {
      explanation = `Saved by ${bookmarkCount} student${bookmarkCount === 1 ? '' : 's'} across EventSync.`;
    } else if (urgencyBonus > 0) {
      explanation = 'Active event closing soon. High registration momentum.';
    } else {
      explanation = 'Upcoming verified event on EventSync.';
    }

    return {
      event,
      eventId: id,
      trendingScore,
      bookmarkCount,
      isTrending,
      explanation,
    };
  });

  // 4. Sort: highest trendingScore first; secondary sort: earlier deadline; deterministic tie-break
  scoredTrending.sort((a, b) => {
    if (a.trendingScore !== b.trendingScore) {
      return b.trendingScore - a.trendingScore;
    }
    const aTime = a.event?.registrationDeadline ? new Date(a.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.event?.registrationDeadline ? new Date(b.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return String(a.eventId).localeCompare(String(b.eventId));
  });

  const totalEvents = scoredTrending.length;
  const totalPages = Math.ceil(totalEvents / limit) || 1;
  const skip = (page - 1) * limit;
  const paginated = scoredTrending.slice(skip, skip + limit);

  return {
    success: true,
    type: 'trending',
    hasEngagementData,
    recommendations: paginated,
    events: paginated.map((item) => ({
      ...item.event,
      matchReason: item.explanation,
      matchScore: item.isTrending ? `${item.bookmarkCount} saves` : null,
      trendingScore: item.trendingScore,
      bookmarkCount: item.bookmarkCount,
      isTrending: item.isTrending,
    })),
    pagination: {
      page,
      limit,
      totalEvents,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Category 3: Similar to Your Interests
 * 
 * Scores and ranks events based on the user's selected interests, tags, and categories.
 * Supports filtering by a specific interest tag or ranking across all profile interests.
 */
async function getSimilarEventsForUser(user, queryParams = {}) {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 12, 1), 50);
  const now = queryParams.now instanceof Date ? queryParams.now : new Date();

  const userInterests = Array.isArray(user?.interests) ? user.interests.filter(Boolean) : [];
  const rawInterestQuery = (queryParams.interest && typeof queryParams.interest === 'string')
    ? queryParams.interest.trim()
    : '';

  const isAll = rawInterestQuery.toLowerCase() === 'all' || (!rawInterestQuery && userInterests.length > 0);
  const selectedInterest = isAll ? (rawInterestQuery.toLowerCase() === 'all' ? 'All Interests' : userInterests[0]) : rawInterestQuery;

  // If user has no interests in profile and no specific interest queried
  if (userInterests.length === 0 && !rawInterestQuery) {
    return {
      success: true,
      type: 'similar',
      isColdStart: true,
      selectedInterest: '',
      recommendations: [],
      events: [],
      pagination: {
        page: 1,
        limit,
        totalEvents: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      message: 'No profile interests configured',
    };
  }

  // Build filter targeting the selected interest or all interests
  const targetInterests = isAll ? userInterests : (selectedInterest ? [selectedInterest] : userInterests);

  const filter = {
    isVerified: true,
    $or: [
      { registrationDeadline: { $gte: now } },
      { registrationDeadline: null, startDate: { $gte: now } },
    ],
  };

  if (isAll && userInterests.length > 0) {
    const orConditions = [];
    for (const interest of userInterests) {
      const escaped = escapeRegex(interest);
      orConditions.push({ category: new RegExp(`^${escaped}$`, 'i') });
      orConditions.push({ tags: { $in: [new RegExp(escaped, 'i')] } });
      orConditions.push({ title: { $regex: escaped, $options: 'i' } });
      orConditions.push({ description: { $regex: escaped, $options: 'i' } });
    }
    filter.$and = [{ $or: orConditions }];
  } else if (selectedInterest) {
    const escapedInterest = escapeRegex(selectedInterest);
    filter.$and = [
      {
        $or: [
          { category: new RegExp(`^${escapedInterest}$`, 'i') },
          { tags: { $in: [new RegExp(escapedInterest, 'i')] } },
          { title: { $regex: escapedInterest, $options: 'i' } },
          { description: { $regex: escapedInterest, $options: 'i' } },
        ],
      },
    ];
  }

  const rawEvents = await Event.find(filter, EVENT_PROJECTION).lean();
  const eligibleEvents = deduplicateEvents(rawEvents);

  // Score events specifically for the target interest using Step 5 scoring engine
  const scoredList = [];
  for (const event of eligibleEvents) {
    const scoreResult = calculateEventRelevance(event, { interests: targetInterests }, { now, excludeExpired: true });
    if (scoreResult.isEligible) {
      const matchLabel = isAll ? 'Matches your profile interests' : `Matches your interest in #${selectedInterest}`;
      scoredList.push({
        event,
        eventId: scoreResult.eventId,
        score: scoreResult.score,
        matchPercentage: scoreResult.matchPercentage,
        explanation: scoreResult.explanation || matchLabel,
        signals: scoreResult.signals,
      });
    }
  }

  // Sort: higher score first, tie breaker: earlier deadline, deterministic ID compare
  scoredList.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const aTime = a.event?.registrationDeadline ? new Date(a.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.event?.registrationDeadline ? new Date(b.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return String(a.eventId).localeCompare(String(b.eventId));
  });

  const totalEvents = scoredList.length;
  const totalPages = Math.ceil(totalEvents / limit) || 1;
  const skip = (page - 1) * limit;
  const paginated = scoredList.slice(skip, skip + limit);

  return {
    success: true,
    type: 'similar',
    isColdStart: false,
    selectedInterest,
    userInterests,
    recommendations: paginated,
    events: paginated.map((item) => ({
      ...item.event,
      matchScore: item.matchPercentage,
      matchReason: item.explanation,
      score: item.score,
    })),
    pagination: {
      page,
      limit,
      totalEvents,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Category 4: Nearby Events
 * 
 * Filters in-person and hybrid events (strictly excluding online events)
 * and ranks by geographic proximity (Haversine km) using valid coordinates.
 */
async function getNearbyEvents(queryParams = {}) {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 12, 1), 50);
  const now = queryParams.now instanceof Date ? queryParams.now : new Date();

  const radiusKm = Math.min(Math.max(Number(queryParams.radiusKm) || 100, 1), 5000);
  const lat = queryParams.latitude !== undefined && queryParams.latitude !== null ? Number(queryParams.latitude) : null;
  const lon = queryParams.longitude !== undefined && queryParams.longitude !== null ? Number(queryParams.longitude) : null;
  const locationName = typeof queryParams.locationName === 'string' ? queryParams.locationName.trim() : '';

  const hasCoords = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // Filter: verified, upcoming, strictly in-person or hybrid (never online)
  const filter = {
    isVerified: true,
    mode: { $in: ['Offline', 'Hybrid'] },
    $or: [
      { registrationDeadline: { $gte: now } },
      { registrationDeadline: null, startDate: { $gte: now } },
    ],
  };

  // If text location name provided without coordinates, match venue, locationName, or college via $and
  // so the upcoming deadline filter ($or above) is never overwritten.
  if (!hasCoords && locationName) {
    const escaped = escapeRegex(locationName);
    filter.$and = [
      {
        $or: [
          { venue: { $regex: escaped, $options: 'i' } },
          { locationName: { $regex: escaped, $options: 'i' } },
          { college: { $regex: escaped, $options: 'i' } },
        ],
      },
    ];
  }

  const rawEvents = await Event.find(filter, EVENT_PROJECTION).lean();
  const eligibleEvents = deduplicateEvents(rawEvents);

  let scoredEvents = [];

  if (hasCoords) {
    for (const event of eligibleEvents) {
      if (!event.location || !Array.isArray(event.location.coordinates) || event.location.coordinates.length < 2) {
        continue;
      }

      const [eventLon, eventLat] = event.location.coordinates;
      if (typeof eventLat !== 'number' || typeof eventLon !== 'number' || isNaN(eventLat) || isNaN(eventLon)) {
        continue;
      }

      const distanceKm = calculateHaversineKm(lat, lon, eventLat, eventLon);
      if (distanceKm <= radiusKm) {
        const roundedDist = Number(distanceKm.toFixed(1));
        const venueName = event.venue || event.locationName || event.mode;
        scoredEvents.push({
          event: {
            ...event,
            distanceKm: roundedDist,
          },
          eventId: String(event._id),
          distanceKm: roundedDist,
          explanation: `📍 ${roundedDist} km away (${venueName})`,
        });
      }
    }

    // Sort by proximity: closest first; secondary sort by registration deadline; deterministic ID
    scoredEvents.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      const aTime = a.event?.registrationDeadline ? new Date(a.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.event?.registrationDeadline ? new Date(b.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return String(a.eventId).localeCompare(String(b.eventId));
    });
  } else {
    // Fallback: sorted by deadline ascending; deterministic ID
    scoredEvents = eligibleEvents.map((event) => ({
      event,
      eventId: String(event._id),
      distanceKm: null,
      explanation: event.locationName || event.venue ? `📍 ${event.locationName || event.venue}` : 'In-person / Hybrid opportunity',
    }));

    scoredEvents.sort((a, b) => {
      const aTime = a.event?.registrationDeadline ? new Date(a.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.event?.registrationDeadline ? new Date(b.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return String(a.eventId).localeCompare(String(b.eventId));
    });
  }

  const totalEvents = scoredEvents.length;
  const totalPages = Math.ceil(totalEvents / limit) || 1;
  const skip = (page - 1) * limit;
  const paginated = scoredEvents.slice(skip, skip + limit);

  return {
    success: true,
    type: 'nearby',
    recommendations: paginated,
    events: paginated.map((item) => ({
      ...item.event,
      distanceKm: item.distanceKm,
      matchReason: item.explanation,
    })),
    pagination: {
      page,
      limit,
      totalEvents,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    locationSearch: {
      active: hasCoords || Boolean(locationName),
      latitude: hasCoords ? lat : null,
      longitude: hasCoords ? lon : null,
      radiusKm,
      locationName: locationName || (hasCoords ? 'Selected location' : ''),
    },
  };
}

/**
 * Unified Recommendation Gateway:
 * Routes request to category-specific handler based on queryParams.type
 * 
 * @param {string|object} userOrId - Authenticated User document or ObjectId/String
 * @param {object} [queryParams] - Query options and filters
 * @returns {Promise<object>} Ranked recommendations payload
 */
async function getRecommendedEventsForUser(userOrId, queryParams = {}) {
  const type = (queryParams.type || 'for-you').toLowerCase().trim();

  // Resolve user profile for personalized tabs
  const user = await resolveUserProfile(userOrId);
  if (!user && (type === 'for-you' || type === 'similar')) {
    return {
      notFound: true,
      message: 'User profile not found',
    };
  }

  switch (type) {
    case 'trending':
      return getTrendingEvents(queryParams);

    case 'similar':
      return getSimilarEventsForUser(user, queryParams);

    case 'nearby':
      return getNearbyEvents(queryParams);

    case 'for-you':
    default:
      return getForYouEvents(user, queryParams);
  }
}

module.exports = {
  getRecommendedEventsForUser,
  getForYouEvents,
  getTrendingEvents,
  getSimilarEventsForUser,
  getNearbyEvents,
  deduplicateEvents,
  escapeRegex,
};
