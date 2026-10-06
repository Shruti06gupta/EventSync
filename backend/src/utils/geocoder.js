/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Features: rate limiting, caching, error handling
 */

// In-memory cache for geocoding results
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting: ensure 1 second between requests
let lastRequestTime = 0;
const MIN_DELAY = 1000; // 1 second (Nominatim policy)

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if a location should be geocoded
 * @param {string} venue - Event venue
 * @param {string} mode - Event mode
 * @returns {boolean}
 */
const shouldGeocode = (venue, mode) => {
  if (mode === 'Online') {
    return false;
  }

  const venueLower = (venue || '').toLowerCase().trim();

  // Skip exact generic venue values (not substring matching)
  const genericVenues = [
    'offline',
    'online',
    'hybrid',
    'remote',
    'virtual',
    'global',
    'india',
    'online, india',
    'tbd',
    'tba',
    'to be announced',
    'to be decided',
    'tbd, india',
    'tba, india',
  ];

  // Check if venue is exactly one of the generic values
  if (genericVenues.includes(venueLower)) {
    return false;
  }

  // Skip if venue contains these substrings (for cases like "zoom link", "teams meeting")
  const skipSubstrings = ['zoom', 'meet', 'teams'];
  return !skipSubstrings.some((keyword) => venueLower.includes(keyword));
};

/**
 * Get cached geocoding result
 * @param {string} locationName - Location name to look up
 * @returns {object|null} Cached result or null
 */
const getCached = (locationName) => {
  const cached = cache.get(locationName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

/**
 * Cache geocoding result
 * @param {string} locationName - Location name
 * @param {object} data - Geocoding data to cache
 */
const setCached = (locationName, data) => {
  cache.set(locationName, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Validate latitude and longitude
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lon) => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon)
  );
};

/**
 * Generate progressively simplified fallback queries for geocoding
 * @param {string} venue - Original venue string
 * @returns {Array<string>} Array of fallback queries (original first, then simplified)
 */
const generateFallbackQueries = (venue) => {
  const queries = [venue]; // Original query first

  if (!venue || !venue.trim()) {
    return queries;
  }

  const parts = venue.split(',').map(p => p.trim());
  if (parts.length < 2) {
    return queries; // No meaningful simplification possible
  }

  // Fallback 1: Remove street-level components (Road, Street, Lane, Block with numbers)
  const streetPatterns = [
    /\bRoad\b/i,
    /\bStreet\b/i,
    /\bLane\b/i,
    /\bBlock\s+\d+[A-Z]?\b/i,
    /\bSector\s+\d+[A-Z]?\b/i,
    /\b\d+[A-Z]?\b/i, // Remove standalone numbers like "12A"
  ];

  const simplified1 = parts.filter(part => {
    return !streetPatterns.some(pattern => pattern.test(part));
  }).join(', ');

  if (simplified1 !== venue && simplified1.length > 10) {
    queries.push(simplified1);
  }

  // Fallback 2: Remove institution name, keep city/region/country
  // Assume first part is institution name if there are at least 3 parts
  if (parts.length >= 3) {
    const cityAndRegion = parts.slice(1).join(', ');
    if (cityAndRegion.length > 10) {
      queries.push(cityAndRegion);
    }
  }

  // Fallback 3: Keep only major city/region/country (last 2-3 parts)
  // This ensures we have at least a city name, not just region/country
  if (parts.length >= 4) {
    const majorParts = parts.slice(-3).join(', ');
    if (majorParts.length > 10) {
      queries.push(majorParts);
    }
  }

  // Do NOT include region/country-only fallback (e.g., "Punjab, India")
  // This is too broad for event radius search

  // Remove duplicates while preserving order
  return [...new Set(queries)];
};

/**
 * Validate coordinate consistency with venue region
 * @param {string} venue - Event venue
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean}
 */
const validateCoordinateConsistency = (venue, lat, lon) => {
  const venueLower = (venue || '').toLowerCase();

  // India bounding box (approximate)
  const indiaBounds = {
    minLat: 8,
    maxLat: 37,
    minLon: 68,
    maxLon: 97,
  };

  // Punjab region bounding box (approximate)
  const punjabBounds = {
    minLat: 29.5,
    maxLat: 32.5,
    minLon: 73.5,
    maxLon: 77.5,
  };

  // Chandigarh region (approximate 50km radius)
  const chandigarhCenter = { lat: 30.7333, lon: 76.7794 };
  const chandigarhRadius = 0.5; // ~50km in degrees

  // Patiala region (approximate 50km radius)
  const patialaCenter = { lat: 30.3398, lon: 76.3869 };
  const patialaRadius = 0.5;

  // Mohali region (approximate 50km radius)
  const mohaliCenter = { lat: 30.7046, lon: 76.6997 };
  const mohaliRadius = 0.5;

  // West Bengal region (approximate)
  const westBengalBounds = {
    minLat: 21.5,
    maxLat: 27.5,
    minLon: 85.5,
    maxLon: 89.5,
  };

  // Karnataka region (approximate)
  const karnatakaBounds = {
    minLat: 11.5,
    maxLat: 18.5,
    minLon: 74,
    maxLon: 78.5,
  };

  // Maharashtra region (approximate)
  const maharashtraBounds = {
    minLat: 15.5,
    maxLat: 22,
    minLon: 72,
    maxLon: 80.5,
  };

  // Check India
  if (venueLower.includes('india')) {
    if (lat < indiaBounds.minLat || lat > indiaBounds.maxLat ||
        lon < indiaBounds.minLon || lon > indiaBounds.maxLon) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions India but coordinates (${lat}, ${lon}) are outside India`);
      return false;
    }
  }

  // Check Punjab
  if (venueLower.includes('punjab')) {
    if (lat < punjabBounds.minLat || lat > punjabBounds.maxLat ||
        lon < punjabBounds.minLon || lon > punjabBounds.maxLon) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Punjab but coordinates (${lat}, ${lon}) are outside Punjab`);
      return false;
    }
  }

  // Check Chandigarh
  if (venueLower.includes('chandigarh')) {
    const distance = Math.sqrt(
      Math.pow(lat - chandigarhCenter.lat, 2) +
      Math.pow(lon - chandigarhCenter.lon, 2)
    );
    if (distance > chandigarhRadius) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Chandigarh but coordinates (${lat}, ${lon}) are too far from Chandigarh`);
      return false;
    }
  }

  // Check Patiala
  if (venueLower.includes('patiala')) {
    const distance = Math.sqrt(
      Math.pow(lat - patialaCenter.lat, 2) +
      Math.pow(lon - patialaCenter.lon, 2)
    );
    if (distance > patialaRadius) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Patiala but coordinates (${lat}, ${lon}) are too far from Patiala`);
      return false;
    }
  }

  // Check Mohali
  if (venueLower.includes('mohali')) {
    const distance = Math.sqrt(
      Math.pow(lat - mohaliCenter.lat, 2) +
      Math.pow(lon - mohaliCenter.lon, 2)
    );
    if (distance > mohaliRadius) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Mohali but coordinates (${lat}, ${lon}) are too far from Mohali`);
      return false;
    }
  }

  // Check West Bengal
  if (venueLower.includes('west bengal')) {
    if (lat < westBengalBounds.minLat || lat > westBengalBounds.maxLat ||
        lon < westBengalBounds.minLon || lon > westBengalBounds.maxLon) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions West Bengal but coordinates (${lat}, ${lon}) are outside West Bengal`);
      return false;
    }
  }

  // Check Karnataka
  if (venueLower.includes('karnataka')) {
    if (lat < karnatakaBounds.minLat || lat > karnatakaBounds.maxLat ||
        lon < karnatakaBounds.minLon || lon > karnatakaBounds.maxLon) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Karnataka but coordinates (${lat}, ${lon}) are outside Karnataka`);
      return false;
    }
  }

  // Check Maharashtra
  if (venueLower.includes('maharashtra')) {
    if (lat < maharashtraBounds.minLat || lat > maharashtraBounds.maxLat ||
        lon < maharashtraBounds.minLon || lon > maharashtraBounds.maxLon) {
      console.warn(`[Geocoder] Coordinate mismatch: venue mentions Maharashtra but coordinates (${lat}, ${lon}) are outside Maharashtra`);
      return false;
    }
  }

  return true;
};

/**
 * Geocode a location name using OpenStreetMap Nominatim
 * Uses progressive fallback to simplify addresses if exact match fails
 * @param {string} locationName - Location name to geocode
 * @returns {Promise<object|null>} Object with { latitude, longitude, displayName } or null on failure
 */
const geocodeLocation = async (locationName) => {
  if (!locationName || !locationName.trim()) {
    return null;
  }

  const trimmedName = locationName.trim();

  // Check cache first
  const cached = getCached(trimmedName);
  if (cached) {
    return cached;
  }

  // Generate fallback queries
  const queries = generateFallbackQueries(trimmedName);

  // Try each query in sequence
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    // Rate limiting: wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_DELAY) {
      await sleep(MIN_DELAY - timeSinceLastRequest);
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EventSync/1.0 (event-discovery-platform)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[Geocoder] Nominatim API error: ${response.status} for query: ${query}`);
        continue; // Try next fallback
      }

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        console.warn(`[Geocoder] No results for query: ${query}`);
        continue; // Try next fallback
      }

      const match = results[0];
      const latitude = Number(match.lat);
      const longitude = Number(match.lon);

      // Validate coordinates
      if (!isValidCoordinate(latitude, longitude)) {
        console.warn(`[Geocoder] Invalid coordinates for query ${query}: lat=${latitude}, lon=${longitude}`);
        continue; // Try next fallback
      }

      // Validate coordinate consistency with venue region (use original venue for validation)
      if (!validateCoordinateConsistency(trimmedName, latitude, longitude)) {
        console.warn(`[Geocoder] Coordinate consistency check failed for query ${query}: lat=${latitude}, lon=${longitude}`);
        continue; // Try next fallback
      }

      // Success!
      const result = {
        latitude,
        longitude,
        displayName: match.display_name || query,
      };

      // Update last request time
      lastRequestTime = Date.now();

      // Cache the result using the original venue as key
      setCached(trimmedName, result);

      const fallbackNote = i === 0 ? 'exact match' : `fallback ${i}`;
      console.log(`[Geocoder] Successfully geocoded (${fallbackNote}): ${trimmedName} → ${latitude}, ${longitude} (using query: "${query}")`);
      return result;
    } catch (error) {
      console.error(`[Geocoder] Error geocoding query ${query}:`, error.message);
      continue; // Try next fallback
    }
  }

  // All queries failed
  console.warn(`[Geocoder] All fallback queries failed for: ${trimmedName}`);
  return null;
};

/**
 * Clear the geocoding cache (useful for testing)
 */
const clearCache = () => {
  cache.clear();
  console.log('[Geocoder] Cache cleared');
};

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
const getCacheStats = () => {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
};

module.exports = {
  geocodeLocation,
  shouldGeocode,
  isValidCoordinate,
  validateCoordinateConsistency,
  clearCache,
  getCacheStats,
};
