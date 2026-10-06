/**
 * Test geospatial search directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');

const testGeospatialSearch = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Test] Connected to MongoDB\n');

    // Test coordinates (Delhi)
    const latitude = 28.6139;
    const longitude = 77.2090;

    console.log('[Test] Testing geospatial search from Delhi (28.6139, 77.2090)\n');

    // Test 1: 10km radius
    console.log('[Test 1] Events within 10km...');
    const events10km = await Event.find({
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 10 * 1000, // 10km in meters
        },
      },
    });
    console.log(`Found ${events10km.length} events:`);
    events10km.forEach(e => {
      console.log(`  - ${e.title} (${e.venue})`);
    });
    console.log();

    // Test 2: 25km radius
    console.log('[Test 2] Events within 25km...');
    const events25km = await Event.find({
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 25 * 1000,
        },
      },
    });
    console.log(`Found ${events25km.length} events:`);
    events25km.forEach(e => {
      console.log(`  - ${e.title} (${e.venue})`);
    });
    console.log();

    // Test 3: 50km radius
    console.log('[Test 3] Events within 50km...');
    const events50km = await Event.find({
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 50 * 1000,
        },
      },
    });
    console.log(`Found ${events50km.length} events:`);
    events50km.forEach(e => {
      console.log(`  - ${e.title} (${e.venue})`);
    });
    console.log();

    // Test 4: 100km radius
    console.log('[Test 4] Events within 100km...');
    const events100km = await Event.find({
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 100 * 1000,
        },
      },
    });
    console.log(`Found ${events100km.length} events:`);
    events100km.forEach(e => {
      console.log(`  - ${e.title} (${e.venue})`);
    });
    console.log();

    // Test 5: 250km radius
    console.log('[Test 5] Events within 250km...');
    const events250km = await Event.find({
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 250 * 1000,
        },
      },
    });
    console.log(`Found ${events250km.length} events:`);
    events250km.forEach(e => {
      console.log(`  - ${e.title} (${e.venue})`);
    });
    console.log();

    // Test 6: Online events should NOT appear
    console.log('[Test 6] Checking if online events appear in radius search...');
    const onlineEvents = await Event.find({
      isVerified: true,
      mode: 'Online',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 250 * 1000,
        },
      },
    });
    console.log(`Found ${onlineEvents.length} online events in radius search (should be 0)`);
    console.log();

    // Test 7: Events without coordinates should NOT appear
    console.log('[Test 7] Events without location field...');
    const eventsWithoutCoords = await Event.countDocuments({
      isVerified: true,
      $or: [
        { location: { $exists: false } },
        { location: null },
      ],
    });
    console.log(`Total events without coordinates: ${eventsWithoutCoords}`);
    console.log();

    console.log('[Test] All tests completed!');

  } catch (error) {
    console.error('[Test] Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

testGeospatialSearch();
