/**
 * Add test events with coordinates for testing geospatial search
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');

const testEvents = [
  {
    title: 'Test Event Delhi',
    description: 'Test event in Delhi for geospatial search testing',
    organizer: 'Test Organizer',
    college: 'Delhi Technological University',
    category: 'Technology',
    tags: ['test', 'delhi'],
    source: 'manual',
    startDate: new Date('2026-11-01T09:00:00.000Z'),
    endDate: new Date('2026-11-01T17:00:00.000Z'),
    registrationDeadline: new Date('2026-10-25T23:59:59.000Z'),
    mode: 'Offline',
    venue: 'Connaught Place, Delhi',
    location: {
      type: 'Point',
      coordinates: [77.2090, 28.6139], // Delhi
    },
    locationName: 'Connaught Place, Delhi, India',
    image: 'https://picsum.photos/seed/test-delhi/800/400',
    eventLink: 'https://example.com/test-delhi',
    isVerified: true,
    isPublic: true,
  },
  {
    title: 'Test Event Gurgaon',
    description: 'Test event in Gurgaon for geospatial search testing',
    organizer: 'Test Organizer',
    college: 'Gurgaon Institute',
    category: 'Technology',
    tags: ['test', 'gurgaon'],
    source: 'manual',
    startDate: new Date('2026-11-02T09:00:00.000Z'),
    endDate: new Date('2026-11-02T17:00:00.000Z'),
    registrationDeadline: new Date('2026-10-26T23:59:59.000Z'),
    mode: 'Offline',
    venue: 'Cyber City, Gurgaon',
    location: {
      type: 'Point',
      coordinates: [77.0266, 28.4594], // Gurgaon (~30km from Delhi)
    },
    locationName: 'Cyber City, Gurgaon, India',
    image: 'https://picsum.photos/seed/test-gurgaon/800/400',
    eventLink: 'https://example.com/test-gurgaon',
    isVerified: true,
    isPublic: true,
  },
  {
    title: 'Test Event Noida',
    description: 'Test event in Noida for geospatial search testing',
    organizer: 'Test Organizer',
    college: 'Noida Institute',
    category: 'Technology',
    tags: ['test', 'noida'],
    source: 'manual',
    startDate: new Date('2026-11-03T09:00:00.000Z'),
    endDate: new Date('2026-11-03T17:00:00.000Z'),
    registrationDeadline: new Date('2026-10-27T23:59:59.000Z'),
    mode: 'Offline',
    venue: 'Sector 62, Noida',
    location: {
      type: 'Point',
      coordinates: [77.3910, 28.5355], // Noida (~20km from Delhi)
    },
    locationName: 'Sector 62, Noida, India',
    image: 'https://picsum.photos/seed/test-noida/800/400',
    eventLink: 'https://example.com/test-noida',
    isVerified: true,
    isPublic: true,
  },
  {
    title: 'Test Event Jaipur',
    description: 'Test event in Jaipur for geospatial search testing',
    organizer: 'Test Organizer',
    college: 'Jaipur Institute',
    category: 'Technology',
    tags: ['test', 'jaipur'],
    source: 'manual',
    startDate: new Date('2026-11-04T09:00:00.000Z'),
    endDate: new Date('2026-11-04T17:00:00.000Z'),
    registrationDeadline: new Date('2026-10-28T23:59:59.000Z'),
    mode: 'Offline',
    venue: 'Pink City, Jaipur',
    location: {
      type: 'Point',
      coordinates: [75.7873, 26.9124], // Jaipur (~250km from Delhi)
    },
    locationName: 'Pink City, Jaipur, India',
    image: 'https://picsum.photos/seed/test-jaipur/800/400',
    eventLink: 'https://example.com/test-jaipur',
    isVerified: true,
    isPublic: true,
  },
  {
    title: 'Test Event Online',
    description: 'Test online event for testing exclusion from radius search',
    organizer: 'Test Organizer',
    college: 'Online Institute',
    category: 'Technology',
    tags: ['test', 'online'],
    source: 'manual',
    startDate: new Date('2026-11-05T09:00:00.000Z'),
    endDate: new Date('2026-11-05T17:00:00.000Z'),
    registrationDeadline: new Date('2026-10-29T23:59:59.000Z'),
    mode: 'Online',
    venue: 'Zoom',
    image: 'https://picsum.photos/seed/test-online/800/400',
    eventLink: 'https://example.com/test-online',
    isVerified: true,
    isPublic: true,
  },
];

const addTestEvents = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Test] Connected to MongoDB');

    // Check if test events already exist
    const existingCount = await Event.countDocuments({ title: { $regex: /^Test Event/, $options: 'i' } });
    if (existingCount > 0) {
      console.log(`[Test] Found ${existingCount} existing test events. Deleting them...`);
      await Event.deleteMany({ title: { $regex: /^Test Event/, $options: 'i' } });
    }

    // Add test events
    const baseUserId = new mongoose.Types.ObjectId();
    for (const eventData of testEvents) {
      eventData.createdBy = baseUserId;
      const event = new Event(eventData);
      await event.save();
      console.log(`[Test] Added: ${event.title} at ${eventData.location?.coordinates?.join(', ') || 'no coordinates'}`);
    }

    console.log('[Test] Test events added successfully!');
    console.log('[Test] You can now test the geospatial search API');

  } catch (error) {
    console.error('[Test] Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

addTestEvents();
