/**
 * Backfill script to add GeoJSON coordinates to existing events
 *
 * This script queries events without location coordinates and attempts to geocode
 * their venue/locationName fields. It respects rate limits and is resumable.
 *
 * USAGE:
 *   node backend/src/scripts/backfillEventCoordinates.js
 *
 * SAFETY:
 *   - This script does NOT run automatically
 *   - It requires manual execution
 *   - It processes events one at a time with rate limiting
 *   - It skips online/global events
 *   - It logs all actions for audit
 *
 * RESUMABLE:
 *   - The script tracks progress and can be resumed if interrupted
 *   - Progress is saved in a local JSON file
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { geocodeLocation, shouldGeocode, isValidCoordinate } = require('../utils/geocoder');

const PROGRESS_FILE = './backfill-progress.json';
const BATCH_SIZE = 10;

/**
 * Load progress from file
 */
const loadProgress = () => {
  try {
    const fs = require('fs');
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('[Backfill] Could not load progress file:', error.message);
  }
  return { processedIds: [], startTime: null, stats: { success: 0, failed: 0, skipped: 0 } };
};

/**
 * Save progress to file
 */
const saveProgress = (progress) => {
  try {
    const fs = require('fs');
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('[Backfill] Could not save progress file:', error.message);
  }
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process a single event
 */
const processEvent = async (event) => {
  const venue = event.venue || event.locationName || '';
  const mode = event.mode;

  // Skip if should not be geocoded
  if (!shouldGeocode(venue, mode)) {
    console.log(`[Backfill] Skipping ${event.title} (mode: ${mode}, venue: ${venue})`);
    return { status: 'skipped', reason: 'online/global event' };
  }

  // Try to geocode
  console.log(`[Backfill] Geocoding ${event.title} (${venue})...`);
  const coords = await geocodeLocation(venue);

  if (!coords || !isValidCoordinate(coords.latitude, coords.longitude)) {
    console.warn(`[Backfill] Geocoding failed for ${event.title}`);
    return { status: 'failed', reason: 'geocoding failed' };
  }

  // Update event with coordinates
  await Event.findByIdAndUpdate(event._id, {
    $set: {
      location: {
        type: 'Point',
        coordinates: [coords.longitude, coords.latitude],
      },
      locationName: coords.displayName,
    },
  });

  console.log(`[Backfill] Successfully updated ${event.title} → ${coords.latitude}, ${coords.longitude}`);
  return { status: 'success', coordinates: coords };
};

/**
 * Main backfill function
 */
const runBackfill = async () => {
  console.log('[Backfill] Starting event coordinate backfill...');
  console.log('[Backfill] Loading progress...');

  const progress = loadProgress();
  if (!progress.startTime) {
    progress.startTime = new Date().toISOString();
  }

  console.log(`[Backfill] Already processed: ${progress.processedIds.length} events`);
  console.log(`[Backfill] Stats: ${progress.stats.success} success, ${progress.stats.failed} failed, ${progress.stats.skipped} skipped`);

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Backfill] Connected to MongoDB');

    // Query events without location coordinates
    const query = {
      isVerified: true,
      $or: [
        { location: { $exists: false } },
        { location: null },
      ],
    };

    // Exclude already processed events
    if (progress.processedIds.length > 0) {
      query._id = { $nin: progress.processedIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const totalEvents = await Event.countDocuments(query);
    console.log(`[Backfill] Found ${totalEvents} events to process`);

    if (totalEvents === 0) {
      console.log('[Backfill] No events to process. Done!');
      return;
    }

    let processed = 0;
    const cursor = Event.find(query).cursor();

    for await (const event of cursor) {
      try {
        const result = await processEvent(event);

        // Update progress - only add to processedIds on SUCCESS
        // Failed and skipped events remain retryable
        if (result.status === 'success') {
          progress.processedIds.push(event._id.toString());
          progress.stats.success++;
        } else if (result.status === 'failed') {
          progress.stats.failed++;
          // Do NOT add to processedIds - allow retry
        } else if (result.status === 'skipped') {
          progress.stats.skipped++;
          // Do NOT add to processedIds - allow retry if venue changes
        }

        processed++;

        // Save progress every batch
        if (processed % BATCH_SIZE === 0) {
          saveProgress(progress);
          console.log(`[Backfill] Progress: ${processed}/${totalEvents} events processed`);
          console.log(`[Backfill] Stats: ${progress.stats.success} success, ${progress.stats.failed} failed, ${progress.stats.skipped} skipped`);
        }

        // Rate limiting: 1 second between geocoding requests
        await sleep(1000);
      } catch (error) {
        console.error(`[Backfill] Error processing event ${event._id}:`, error.message);
        progress.stats.failed++;
        // Do NOT add to processedIds on error - allow retry
      }
    }

    // Final save
    saveProgress(progress);
    console.log('[Backfill] Backfill complete!');
    console.log(`[Backfill] Final stats: ${progress.stats.success} success, ${progress.stats.failed} failed, ${progress.stats.skipped} skipped`);
    console.log(`[Backfill] Progress saved to ${PROGRESS_FILE}`);
    console.log('[Backfill] You can delete the progress file if you want to start fresh next time.');

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the backfill
runBackfill();
