const { getRecommendedEventsForUser } = require('../services/recommendationService');

/**
 * Controller to handle recommendation requests for all 5 categories:
 * - for-you (default)
 * - trending
 * - similar
 * - nearby
 * GET /events/recommended or GET /api/events/recommended
 */
const getRecommendedEvents = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authorized, user identity missing' });
    }

    const {
      page,
      limit,
      type,
      category,
      search,
      mode,
      interest,
      latitude,
      longitude,
      radiusKm,
      locationName,
    } = req.query;

    // Validate type parameter
    const validTypes = ['for-you', 'trending', 'similar', 'nearby'];
    const activeType = type ? String(type).toLowerCase().trim() : 'for-you';
    if (type !== undefined && !validTypes.includes(activeType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type parameter. Must be one of: ${validTypes.join(', ')}.`,
      });
    }

    // Validate page parameter
    if (page !== undefined && String(page).trim() !== '') {
      const numPage = Number(page);
      if (isNaN(numPage) || numPage < 1 || !Number.isInteger(numPage)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page parameter. Page must be a positive integer.',
        });
      }
    }

    // Validate limit parameter
    if (limit !== undefined && String(limit).trim() !== '') {
      const numLimit = Number(limit);
      if (isNaN(numLimit) || numLimit < 1 || numLimit > 100 || !Number.isInteger(numLimit)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Limit must be an integer between 1 and 100.',
        });
      }
    }

    // Validate coordinates if provided
    const hasLat = latitude !== undefined && latitude !== null && String(latitude).trim() !== '';
    const hasLon = longitude !== undefined && longitude !== null && String(longitude).trim() !== '';

    if (hasLat !== hasLon) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude must be provided together.',
      });
    }

    if (hasLat && hasLon) {
      const numLat = Number(latitude);
      const numLon = Number(longitude);
      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude parameter. Must be a number between -90 and 90.',
        });
      }
      if (isNaN(numLon) || numLon < -180 || numLon > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid longitude parameter. Must be a number between -180 and 180.',
        });
      }
    }

    if (radiusKm !== undefined && String(radiusKm).trim() !== '') {
      const numRadius = Number(radiusKm);
      if (isNaN(numRadius) || numRadius < 1 || numRadius > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Invalid radiusKm parameter. Must be a number between 1 and 5000.',
        });
      }
    }

    const result = await getRecommendedEventsForUser(req.user, {
      type: activeType,
      page: page && String(page).trim() !== '' ? parseInt(page, 10) : 1,
      limit: limit && String(limit).trim() !== '' ? parseInt(limit, 10) : 12,
      category,
      search,
      mode,
      interest,
      latitude: hasLat ? Number(latitude) : null,
      longitude: hasLon ? Number(longitude) : null,
      radiusKm: radiusKm && String(radiusKm).trim() !== '' ? Number(radiusKm) : 100,
      locationName,
    });

    if (result.notFound) {
      return res.status(404).json({ success: false, message: result.message || 'User profile not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Recommendations fetched successfully',
      ...result,
    });
  } catch (error) {
    console.error('[RecommendationsController] Error fetching recommendations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

module.exports = {
  getRecommendedEvents,
};
