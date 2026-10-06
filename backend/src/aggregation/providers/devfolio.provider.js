const axios = require('axios');
const { cleanText } = require('../utils/textCleaner');
const { geocodeLocation, shouldGeocode, isValidCoordinate } = require('../../utils/geocoder');

const parseDevfolioItem = async (item, cutoffDate, now) => {
  const source = item?._source;
  if (!source) return null;

  let regnDeadline = source.hackathon_setting?.reg_ends_at ? new Date(source.hackathon_setting.reg_ends_at) : null;
  let startDate = source.starts_at ? new Date(source.starts_at) : null;
  let endDate = source.ends_at ? new Date(source.ends_at) : null;

  // Use startDate if regnDeadline is not available
  if (!regnDeadline && startDate) regnDeadline = new Date(startDate.getTime());

  // Skip events that are strictly in the past
  const checkDate = endDate || regnDeadline || startDate;
  if (checkDate && checkDate < cutoffDate) {
    return null;
  }

  const title = source.name;
  const slug = source.slug;
  const link = slug ? `https://${slug}.devfolio.co` : null;
  if (!title || !link) return null;

  const organizer = source.hosted_by || 'Devfolio Host';
  const image = source.hackathon_setting?.logo || source.cover_img || '';

  let descriptionText = cleanText(source.desc || source.tagline || '');
  if (!descriptionText) {
    descriptionText = `Join ${title} on Devfolio!`;
  }
  descriptionText = descriptionText.length > 800 ? descriptionText.substring(0, 797) + '...' : descriptionText;

  const venue = source.location || source.city || 'Online';
  let mode = 'Offline';
  if (source.apply_mode === 'online' || source.is_online || venue.toLowerCase().includes('online')) {
    mode = 'Online';
  } else if (source.apply_mode === 'both' || venue.toLowerCase().includes('hybrid')) {
    mode = 'Hybrid';
  }

  // Fallback for missing dates to prevent validation errors
  if (!startDate) startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (!endDate) endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (!regnDeadline) regnDeadline = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);

  // Enforce basic timeline constraints
  if (startDate < regnDeadline) startDate = new Date(regnDeadline.getTime());
  if (endDate < startDate) endDate = new Date(startDate.getTime());

  // Geocode location for offline events
  let location = null;
  let locationName = venue;
  if (shouldGeocode(venue, mode)) {
    try {
      const coords = await geocodeLocation(venue);
      if (coords && isValidCoordinate(coords.latitude, coords.longitude)) {
        location = {
          type: 'Point',
          coordinates: [coords.longitude, coords.latitude],
        };
        locationName = coords.displayName;
      }
    } catch (error) {
      // Geocoding failed - save event without coordinates
      console.warn(`[Devfolio] Geocoding failed for ${title}: ${error.message}`);
    }
  }

  return {
    title,
    description: descriptionText,
    organizer,
    college: 'Public',
    category: 'Hackathon',
    tags: ['devfolio', 'hackathon'],
    source: 'devfolio',
    startDate,
    endDate,
    registrationDeadline: regnDeadline,
    mode,
    venue,
    locationName,
    location,
    image: image || `https://picsum.photos/seed/${encodeURIComponent(title)}/800/400`,
    eventLink: link,
    isVerified: true,
    isAggregated: true,
    isPublic: true,
  };
};

/**
 * Fetch events from Devfolio via public API
 * @returns {Promise<Array>} Array of parsed events
 */
const fetchDevfolioEvents = async () => {
  console.log('[Devfolio] Starting event aggregation from API...');
  const events = [];
  const size = 100;
  const MAX_FETCH = 2000;
  const BATCH_SIZE = 4;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  try {
    // Fetch first offset (0)
    const firstRes = await axios.post(
      'https://api.devfolio.co/api/search/hackathons',
      { from: 0, size },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    const firstHits = firstRes.data?.hits?.hits || [];
    const totalHits = typeof firstRes.data?.hits?.total?.value === 'number'
      ? firstRes.data.hits.total.value
      : (typeof firstRes.data?.hits?.total === 'number' ? firstRes.data.hits.total : MAX_FETCH);

    for (const item of firstHits) {
      const parsed = await parseDevfolioItem(item, cutoffDate, now);
      if (parsed) events.push(parsed);
    }
    console.log(`[Devfolio] Offset 0: ${firstHits.length} hits received, total available: ${totalHits}`);

    if (firstHits.length >= size && totalHits > size) {
      const offsets = [];
      for (let offset = size; offset < Math.min(totalHits, MAX_FETCH); offset += size) {
        offsets.push(offset);
      }

      for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
        const batch = offsets.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (from) => {
          try {
            const res = await axios.post(
              'https://api.devfolio.co/api/search/hackathons',
              { from, size },
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                  Accept: 'application/json',
                },
                timeout: 12000,
              }
            );
            const hits = res.data?.hits?.hits || [];
            const parsedItems = await Promise.all(hits.map((item) => parseDevfolioItem(item, cutoffDate, now)));
            return parsedItems.filter(Boolean);
          } catch (err) {
            console.warn(`[Devfolio] Failed offset ${from}: ${err.message}`);
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((offsetEvents) => {
          events.push(...offsetEvents);
        });
      }
    }

    console.log(`[Devfolio] Total active events fetched: ${events.length}`);
  } catch (error) {
    console.error('[Devfolio] Error fetching events:', error.message);
    throw new Error(`Devfolio aggregation failed: ${error.message}`);
  }

  return events;
};

module.exports = {
  fetchDevfolioEvents,
};