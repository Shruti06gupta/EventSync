/**
 * EventSync Recommendation Scoring Utility (Frontend)
 * 
 * Provides deterministic, multi-factor relevance scoring and ranking for events
 * based on verified user profile signals (interests, college, bookmarks, timing).
 * Works completely offline without external AI calls or random numbers.
 */

/**
 * Normalizes a string: trims, lowercases, and removes punctuation
 * @param {string} str 
 * @returns {string}
 */
export function normalizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes an array of strings or comma-separated string
 * @param {string|string[]} list 
 * @returns {string[]}
 */
export function normalizeTagList(list) {
  if (!list) return [];
  const rawArray = Array.isArray(list)
    ? list
    : typeof list === 'string'
    ? list.split(',')
    : [];

  const uniqueSet = new Set();
  for (const item of rawArray) {
    const cleaned = normalizeText(item);
    if (cleaned) {
      uniqueSet.add(cleaned);
    }
  }
  return Array.from(uniqueSet);
}

/**
 * Checks if a token matches within text using word boundaries to prevent bad substring matches
 * @param {string} text 
 * @param {string} token 
 * @returns {boolean}
 */
export function matchesWord(text, token) {
  if (!text || !token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:$|[^a-z0-9-])`, 'i');
  return regex.test(text);
}

/**
 * Calculates distance in kilometers between two coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number}
 */
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/**
 * Calculates deterministic relevance score for a single event against user preference signals
 * 
 * @param {object} event - Event document or object
 * @param {object} userProfile - Available user preference fields
 * @param {string[]} [userProfile.interests] - User-selected interest topics/categories
 * @param {string} [userProfile.college] - User's college affiliation
 * @param {Array} [userProfile.bookmarks] - User's bookmarked events or IDs
 * @param {string[]} [userProfile.skills] - Optional user skills
 * @param {object} [options]
 * @param {Date} [options.now] - Reference time for deadline evaluations (default: new Date())
 * @param {boolean} [options.excludeExpired=true] - Exclude events whose registration deadline has passed
 * @param {object} [options.location] - Optional search location { latitude, longitude, locationName }
 * @returns {object} Scored result with score, breakdown, reasons, and match percentage
 */
export function calculateEventRelevance(event, userProfile = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const excludeExpired = options.excludeExpired !== false;

  const eventId = event?._id ? String(event._id) : (event?.id ? String(event.id) : null);

  // 1. Ineligibility / Expiration Check
  if (!event || typeof event !== 'object') {
    return {
      eventId: null,
      isEligible: false,
      ineligibleReason: 'Missing or invalid event object',
      score: 0,
      matchPercentage: null,
      formattedMatch: null,
      isPersonalized: false,
      isColdStart: false,
      signals: {},
      reasons: [],
      explanation: 'Ineligible event',
    };
  }

  // Unverified events are not eligible for recommendations
  if (event.isVerified === false) {
    return {
      eventId,
      isEligible: false,
      ineligibleReason: 'Event is not verified',
      score: 0,
      matchPercentage: null,
      formattedMatch: null,
      isPersonalized: false,
      isColdStart: false,
      signals: {},
      reasons: [],
      explanation: 'Event is pending verification',
    };
  }

  // Check registration deadline
  let deadlineDate = null;
  if (event.registrationDeadline) {
    const parsed = new Date(event.registrationDeadline);
    if (!isNaN(parsed.getTime())) {
      deadlineDate = parsed;
    }
  }

  const isExpired = deadlineDate !== null && deadlineDate.getTime() < now.getTime();
  if (isExpired && excludeExpired) {
    return {
      eventId,
      isEligible: false,
      ineligibleReason: 'Registration deadline has passed',
      score: 0,
      matchPercentage: null,
      formattedMatch: null,
      isPersonalized: false,
      isColdStart: false,
      signals: {},
      reasons: [],
      explanation: 'Registration closed for this event',
    };
  }

  // 2. Extract and Normalize User Inputs
  const userInterests = normalizeTagList(userProfile?.interests);
  const userCollege = normalizeText(userProfile?.college);
  const userSkills = normalizeTagList(userProfile?.skills);
  const userBookmarks = Array.isArray(userProfile?.bookmarks) ? userProfile.bookmarks : [];

  // Extract bookmark topics from populated bookmarks if provided
  const bookmarkedCategories = new Set();
  const bookmarkedTags = new Set();
  for (const bm of userBookmarks) {
    if (bm && typeof bm === 'object') {
      if (bm.category) bookmarkedCategories.add(normalizeText(bm.category));
      if (Array.isArray(bm.tags)) {
        for (const t of bm.tags) {
          const nt = normalizeText(t);
          if (nt) bookmarkedTags.add(nt);
        }
      }
    }
  }

  // 3. Extract and Normalize Event Inputs
  const eventCategory = normalizeText(event.category);
  const eventTags = normalizeTagList(event.tags);
  const eventCollege = normalizeText(event.college);
  const eventTitle = normalizeText(event.title);
  const eventDescription = normalizeText(event.description);
  const eventMode = normalizeText(event.mode);

  // 4. Determine Cold-Start Condition
  const hasInterests = userInterests.length > 0;
  const hasCollege = Boolean(userCollege);
  const hasSkills = userSkills.length > 0;
  const hasBookmarkHistory = bookmarkedCategories.size > 0 || bookmarkedTags.size > 0;
  const isColdStart = !hasInterests && !hasCollege && !hasSkills && !hasBookmarkHistory;

  // 5. Evaluate Multi-Factor Signals
  const activeSignals = [];
  const matchedInterests = [];
  const matchedTags = [];
  const matchedSkills = [];
  const reasons = [];

  // --------------------------------------------------------------------------
  // SIGNAL 1: Interest & Category Overlap (Weight: 40)
  // --------------------------------------------------------------------------
  let interestSignal = { name: 'interests', active: false, weight: 40, rawScore: 0 };
  if (hasInterests) {
    interestSignal.active = true;

    // Check direct category match
    const categoryMatches = userInterests.includes(eventCategory);
    if (categoryMatches) {
      matchedInterests.push(eventCategory);
    }

    // Check tag overlaps
    for (const interest of userInterests) {
      if (eventTags.includes(interest)) {
        if (!matchedInterests.includes(interest)) {
          matchedInterests.push(interest);
        }
        matchedTags.push(interest);
      }
    }

    if (categoryMatches && matchedTags.length > 0) {
      interestSignal.rawScore = 1.0;
    } else if (categoryMatches) {
      interestSignal.rawScore = 0.85;
    } else if (matchedTags.length > 0) {
      const overlapRatio = Math.min(matchedTags.length / Math.min(userInterests.length, 3), 1.0);
      interestSignal.rawScore = 0.5 + 0.45 * overlapRatio;
    } else {
      interestSignal.rawScore = 0.0;
    }

    activeSignals.push(interestSignal);
  }

  // --------------------------------------------------------------------------
  // SIGNAL 2: Content Relevance in Title/Description (Weight: 10)
  // --------------------------------------------------------------------------
  let contentSignal = { name: 'content', active: false, weight: 10, rawScore: 0 };
  if (hasInterests) {
    contentSignal.active = true;
    const remainingInterests = userInterests.filter(i => !matchedInterests.includes(i));

    let contentMatches = 0;
    for (const interest of remainingInterests) {
      if (matchesWord(eventTitle, interest)) {
        contentMatches += 1.0;
      } else if (matchesWord(eventDescription, interest)) {
        contentMatches += 0.5;
      }
    }

    if (remainingInterests.length > 0) {
      contentSignal.rawScore = Math.min(contentMatches / remainingInterests.length, 1.0);
    } else if (matchedInterests.length > 0) {
      contentSignal.rawScore = 1.0;
    }

    activeSignals.push(contentSignal);
  }

  // --------------------------------------------------------------------------
  // SIGNAL 3: College Affiliation (Weight: 20)
  // --------------------------------------------------------------------------
  let collegeSignal = { name: 'college', active: false, weight: 20, rawScore: 0 };
  if (hasCollege) {
    collegeSignal.active = true;

    if (eventCollege === userCollege) {
      collegeSignal.rawScore = 1.0;
      reasons.push(`Hosted by your institution (${event.college || userProfile.college})`);
    } else if (eventCollege === 'public' || event.isPublic === true || eventCollege.includes('open')) {
      collegeSignal.rawScore = 0.65;
    } else if (eventCollege) {
      collegeSignal.rawScore = 0.15;
    } else {
      collegeSignal.rawScore = 0.50;
    }

    activeSignals.push(collegeSignal);
  }

  // --------------------------------------------------------------------------
  // SIGNAL 4: Bookmark / Activity Affinity (Weight: 20)
  // --------------------------------------------------------------------------
  let bookmarkSignal = { name: 'bookmarks', active: false, weight: 20, rawScore: 0 };
  if (hasBookmarkHistory) {
    bookmarkSignal.active = true;

    const matchedBmCategory = eventCategory && bookmarkedCategories.has(eventCategory);
    const matchedBmTags = eventTags.filter(t => bookmarkedTags.has(t));

    if (matchedBmCategory && matchedBmTags.length > 0) {
      bookmarkSignal.rawScore = 1.0;
      reasons.push(`Similar to categories and topics in your saved events`);
    } else if (matchedBmCategory) {
      bookmarkSignal.rawScore = 0.8;
      reasons.push(`Shares category with events you have bookmarked`);
    } else if (matchedBmTags.length > 0) {
      bookmarkSignal.rawScore = Math.min(0.4 + 0.3 * matchedBmTags.length, 0.85);
      reasons.push(`Shares tags with your bookmarked events`);
    } else {
      bookmarkSignal.rawScore = 0.0;
    }

    activeSignals.push(bookmarkSignal);
  }

  // --------------------------------------------------------------------------
  // SIGNAL 5: Skill Relevance (Weight: 10, when skills are provided)
  // --------------------------------------------------------------------------
  let skillSignal = { name: 'skills', active: false, weight: 10, rawScore: 0 };
  if (hasSkills) {
    skillSignal.active = true;
    for (const skill of userSkills) {
      if (eventTags.includes(skill) || matchesWord(eventTitle, skill) || matchesWord(eventDescription, skill)) {
        matchedSkills.push(skill);
      }
    }

    if (matchedSkills.length > 0) {
      skillSignal.rawScore = Math.min(matchedSkills.length / Math.min(userSkills.length, 3), 1.0);
      reasons.push(`Aligns with your skills in ${matchedSkills.slice(0, 2).join(', ')}`);
    }

    activeSignals.push(skillSignal);
  }

  // --------------------------------------------------------------------------
  // SIGNAL 6: Timing & Registration Urgency (Weight: 10)
  // --------------------------------------------------------------------------
  let timingSignal = { name: 'timing', active: true, weight: 10, rawScore: 0.5 };
  if (deadlineDate) {
    const diffMs = deadlineDate.getTime() - now.getTime();
    const daysUntilDeadline = diffMs / (1000 * 60 * 60 * 24);

    if (daysUntilDeadline > 0) {
      if (daysUntilDeadline <= 3) {
        timingSignal.rawScore = 1.0;
      } else if (daysUntilDeadline <= 7) {
        timingSignal.rawScore = 0.85;
      } else if (daysUntilDeadline <= 21) {
        timingSignal.rawScore = 0.70;
      } else if (daysUntilDeadline <= 60) {
        timingSignal.rawScore = 0.55;
      } else {
        timingSignal.rawScore = 0.40;
      }
    } else {
      timingSignal.rawScore = 0.1;
    }
  }
  activeSignals.push(timingSignal);

  // --------------------------------------------------------------------------
  // SIGNAL 7: Location Proximity (Weight: 15, when location options provided)
  // --------------------------------------------------------------------------
  let locationSignal = { name: 'location', active: false, weight: 15, rawScore: 0 };
  if (options.location && typeof options.location === 'object') {
    const userLat = Number(options.location.latitude);
    const userLng = Number(options.location.longitude);
    const userLocName = normalizeText(options.location.locationName);

    locationSignal.active = true;

    if (eventMode === 'online') {
      locationSignal.rawScore = 0.85;
    } else if (!isNaN(userLat) && !isNaN(userLng) && event.location?.coordinates?.length >= 2) {
      const [eventLng, eventLat] = event.location.coordinates;
      const distKm = calculateHaversineKm(userLat, userLng, eventLat, eventLng);

      if (distKm <= 10) {
        locationSignal.rawScore = 1.0;
        reasons.push(`Within 10 km of your selected location`);
      } else if (distKm <= 25) {
        locationSignal.rawScore = 0.85;
        reasons.push(`Within 25 km of your location`);
      } else if (distKm <= 50) {
        locationSignal.rawScore = 0.65;
      } else if (distKm <= 100) {
        locationSignal.rawScore = 0.45;
      } else {
        locationSignal.rawScore = 0.20;
      }
    } else if (userLocName && (matchesWord(normalizeText(event.locationName), userLocName) || matchesWord(normalizeText(event.venue), userLocName))) {
      locationSignal.rawScore = 0.90;
      reasons.push(`Happening near ${options.location.locationName}`);
    } else {
      locationSignal.rawScore = 0.40;
    }

    activeSignals.push(locationSignal);
  }

  // 6. Compute Weighted Score
  let totalWeightedScore = 0;
  let totalActiveWeight = 0;
  const breakdown = {};

  for (const sig of activeSignals) {
    const contribution = sig.weight * sig.rawScore;
    totalWeightedScore += contribution;
    totalActiveWeight += sig.weight;
    breakdown[sig.name] = {
      weight: sig.weight,
      rawScore: Number(sig.rawScore.toFixed(3)),
      contribution: Number(contribution.toFixed(2)),
    };
  }

  const rawPercentage = totalActiveWeight > 0 ? (totalWeightedScore / totalActiveWeight) * 100 : 0;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawPercentage)));

  // 7. Evidence-based Explanation and Match Formulation
  if (matchedInterests.length > 0) {
    if (matchedInterests.length === 1) {
      reasons.unshift(`Matches your ${matchedInterests[0]} interest`);
    } else {
      reasons.unshift(`Matches your interests in ${matchedInterests.slice(0, 2).join(' and ')}`);
    }
  }

  const hasPositivePersonalMatch = interestSignal.rawScore > 0 || collegeSignal.rawScore >= 0.9 || bookmarkSignal.rawScore > 0 || skillSignal.rawScore > 0;
  const isPersonalized = !isColdStart && hasPositivePersonalMatch;

  let matchPercentage = null;
  let formattedMatch = null;
  let explanation = '';

  if (isColdStart) {
    explanation = 'Upcoming verified event. Add interests to your profile for personalized matching.';
    reasons.push('Upcoming verified event on EventSync');
  } else if (!isPersonalized) {
    explanation = 'Upcoming verified event on EventSync.';
    reasons.push('Active event registration');
  } else {
    matchPercentage = finalScore;
    formattedMatch = `${finalScore}% Match`;

    if (reasons.length > 0) {
      explanation = reasons.slice(0, 2).join('. ') + '.';
    } else {
      explanation = 'Matches your profile preferences.';
    }
  }

  return {
    eventId,
    isEligible: true,
    score: isPersonalized ? finalScore : 0,
    rawScore: Number(rawPercentage.toFixed(2)),
    matchPercentage,
    formattedMatch,
    isPersonalized,
    isColdStart,
    signals: {
      matchedInterests,
      matchedTags,
      matchedSkills,
      collegeMatch: collegeSignal.rawScore >= 0.9,
    },
    breakdown,
    reasons,
    explanation,
  };
}

/**
 * Scores and ranks a list of events for a user profile
 * 
 * @param {Array} events - Array of event objects
 * @param {object} userProfile - User preference data
 * @param {object} [options] - Optional configuration
 * @returns {object} Ranked list with metadata
 */
export function rankEventsForUser(events = [], userProfile = {}, options = {}) {
  if (!Array.isArray(events)) {
    return {
      results: [],
      totalScored: 0,
      eligibleCount: 0,
      coldStartCount: 0,
    };
  }

  const scoredEvents = [];
  let coldStartCount = 0;

  for (const event of events) {
    const scoreResult = calculateEventRelevance(event, userProfile, options);
    if (scoreResult.isEligible) {
      if (scoreResult.isColdStart) {
        coldStartCount++;
      }
      scoredEvents.push({
        event,
        ...scoreResult,
      });
    }
  }

  // Sort: higher score first; secondary sort by registration deadline ascending (earliest closing first)
  scoredEvents.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    const aDeadline = a.event?.registrationDeadline ? new Date(a.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDeadline = b.event?.registrationDeadline ? new Date(b.event.registrationDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    return aDeadline - bDeadline;
  });

  return {
    results: scoredEvents,
    totalScored: scoredEvents.length,
    eligibleCount: scoredEvents.length,
    coldStartCount,
    isColdStart: coldStartCount === scoredEvents.length && scoredEvents.length > 0,
  };
}
