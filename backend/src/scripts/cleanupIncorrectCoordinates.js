/**
 * Cleanup script to remove incorrect coordinates from events with generic venues
 *
 * This script identifies events that were incorrectly geocoded during the backfill
 * - Events with venue "offline" that got coordinates in Berlin, Germany
 * - Events with venue "hybrid" that got coordinates in France
 * - These coordinates are incorrect and should be removed
 * - The events can then be retried with the fixed backfill script
 *
 * USAGE:
 *   node backend/src/scripts/cleanupIncorrectCoordinates.js
 *
 * SAFETY:
 *   - This script does NOT run automatically
 *   - It requires manual execution
 *   - DRY RUN by default - prints what would be changed
 *   - Set DRY_RUN=false to actually remove coordinates
 *   - It only removes coordinates from events with generic venues
 *   - It logs all actions for audit
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');

const cleanupIncorrectCoordinates = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Cleanup] Connected to MongoDB');

    // DRY RUN MODE - set to false to actually execute cleanup
    // Can be controlled via command line: node cleanupIncorrectCoordinates.js execute
    const DRY_RUN = process.argv.includes('execute') ? false : (process.env.DRY_RUN !== 'false');

    console.log('[Cleanup] DRY RUN MODE:', DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be made)');

    // Identify incorrect coordinates
    const berlinCoords = [13.4204865, 52.4765857];
    const franceCoords = [1.0982204, 47.1188391];
    const genericVenues = ['offline', 'online', 'hybrid', 'remote', 'virtual', 'global', 'india'];

    console.log('[Cleanup] Searching for events with incorrect coordinates...');

    // Find events with Berlin coordinates from generic venues
    const berlinEvents = await Event.find({
      isVerified: true,
      'location.coordinates': berlinCoords,
      venue: { $in: genericVenues.map(v => new RegExp(`^${v}$`, 'i')) }
    }).select('title venue location locationName college').lean();

    // Find events with France coordinates from generic venues
    const franceEvents = await Event.find({
      isVerified: true,
      'location.coordinates': franceCoords,
      venue: { $in: genericVenues.map(v => new RegExp(`^${v}$`, 'i')) }
    }).select('title venue location locationName college').lean();

    const allEventsToClean = [...berlinEvents, ...franceEvents];
    const totalToClean = allEventsToClean.length;

    console.log(`[Cleanup] Found ${berlinEvents.length} events with Berlin coordinates from generic venues`);
    console.log(`[Cleanup] Found ${franceEvents.length} events with France coordinates from generic venues`);
    console.log(`[Cleanup] Total events to clean: ${totalToClean}`);

    if (totalToClean === 0) {
      console.log('[Cleanup] No incorrect coordinates to remove');
      return;
    }

    console.log('\n[Cleanup] DETAILED REPORT:');
    console.log('='.repeat(80));

    // Report Berlin events
    if (berlinEvents.length > 0) {
      console.log(`\nBERLIN COORDINATES [${berlinCoords.join(', ')}] - ${berlinEvents.length} events:`);
      console.log('-'.repeat(80));
      berlinEvents.forEach((e, i) => {
        console.log(`\n${i + 1}. Title: ${e.title}`);
        console.log(`   Venue: ${e.venue}`);
        console.log(`   College: ${e.college}`);
        console.log(`   Current Location: ${JSON.stringify(e.location)}`);
        console.log(`   LocationName: ${e.locationName}`);
        console.log(`   Reason: Generic venue "${e.venue}" should not have geographic coordinates`);
      });
    }

    // Report France events
    if (franceEvents.length > 0) {
      console.log(`\nFRANCE COORDINATES [${franceCoords.join(', ')}] - ${franceEvents.length} events:`);
      console.log('-'.repeat(80));
      franceEvents.forEach((e, i) => {
        console.log(`\n${i + 1}. Title: ${e.title}`);
        console.log(`   Venue: ${e.venue}`);
        console.log(`   College: ${e.college}`);
        console.log(`   Current Location: ${JSON.stringify(e.location)}`);
        console.log(`   LocationName: ${e.locationName}`);
        console.log(`   Reason: Generic venue "${e.venue}" should not have geographic coordinates`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`[Cleanup] SUMMARY: ${totalToClean} events would have their location field removed`);
    console.log('[Cleanup] These events can then be retried with the fixed backfill script');

    if (DRY_RUN) {
      console.log('\n[Cleanup] DRY RUN - No changes were made to the database');
      console.log('[Cleanup] To execute cleanup, run: DRY_RUN=false node backend/src/scripts/cleanupIncorrectCoordinates.js');
      return;
    }

    // ACTUAL CLEANUP (only if DRY_RUN=false)
    console.log('\n[Cleanup] EXECUTING CLEANUP...');

    let totalModified = 0;

    // Remove Berlin coordinates
    if (berlinEvents.length > 0) {
      const berlinResult = await Event.updateMany(
        {
          isVerified: true,
          'location.coordinates': berlinCoords,
          venue: { $in: genericVenues.map(v => new RegExp(`^${v}$`, 'i')) }
        },
        {
          $unset: { location: 1, locationName: 1 }
        }
      );
      console.log(`[Cleanup] Removed Berlin coordinates from ${berlinResult.modifiedCount} events`);
      totalModified += berlinResult.modifiedCount;
    }

    // Remove France coordinates
    if (franceEvents.length > 0) {
      const franceResult = await Event.updateMany(
        {
          isVerified: true,
          'location.coordinates': franceCoords,
          venue: { $in: genericVenues.map(v => new RegExp(`^${v}$`, 'i')) }
        },
        {
          $unset: { location: 1, locationName: 1 }
        }
      );
      console.log(`[Cleanup] Removed France coordinates from ${franceResult.modifiedCount} events`);
      totalModified += franceResult.modifiedCount;
    }

    console.log(`[Cleanup] Total coordinates removed from ${totalModified} events`);
    console.log('[Cleanup] These events can now be retried with the fixed backfill script');

  } catch (error) {
    console.error('[Cleanup] Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

cleanupIncorrectCoordinates();
