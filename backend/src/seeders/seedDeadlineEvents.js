const mongoose = require('mongoose');
require('dotenv').config();
const Event = require('../models/Event');
const connectDB = require('../config/db');

const seedDeadlineEvents = async () => {
  await connectDB();

  console.log('Clearing existing mock deadline events...');
  await Event.deleteMany({ title: { $regex: 'Mock Deadline' } });

  const now = new Date();

  const getFutureDate = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);

  const mockEvents = [
    {
      title: 'Mock Deadline - Weekly',
      description: 'This event will close in about 7 days, triggering the weekly reminder.',
      organizer: 'Tech Club',
      college: 'Delhi Technological University',
      category: 'Hackathon',
      tags: ['hackathon', 'coding'],
      source: 'manual',
      startDate: getFutureDate(7 * 24 + 4),
      endDate: getFutureDate(7 * 24 + 8),
      registrationDeadline: getFutureDate(7 * 24),
      mode: 'Online',
      isPublic: true,
      isVerified: true,
    },
    {
      title: 'Mock Deadline - 24 Hours',
      description: 'This event will close in about 24 hours, triggering the 24h reminder.',
      organizer: 'Design Society',
      college: 'Delhi Technological University',
      category: 'Workshop',
      tags: ['design', 'uiux'],
      source: 'manual',
      startDate: getFutureDate(30),
      endDate: getFutureDate(34),
      registrationDeadline: getFutureDate(24),
      mode: 'Online',
      isPublic: true,
      isVerified: true,
    },
    {
      title: 'Mock Deadline - 6 Hours',
      description: 'This event will close in about 6 hours, triggering the 6h reminder.',
      organizer: 'Open Source Club',
      college: 'Delhi Technological University',
      category: 'Webinar',
      tags: ['opensource', 'git'],
      source: 'manual',
      startDate: getFutureDate(8),
      endDate: getFutureDate(10),
      registrationDeadline: getFutureDate(6),
      mode: 'Online',
      isPublic: true,
      isVerified: true,
    },
    {
      title: 'Mock Deadline - 48 Hours (No Reminder)',
      description: 'This event is 48 hours away and should NOT trigger any reminder.',
      organizer: 'QA Club',
      college: 'Delhi Technological University',
      category: 'Meetup',
      tags: ['qa'],
      source: 'manual',
      startDate: getFutureDate(52),
      endDate: getFutureDate(56),
      registrationDeadline: getFutureDate(48),
      mode: 'Online',
      isPublic: true,
      isVerified: true,
    },
  ];

  try {
    const inserted = await Event.insertMany(mockEvents);
    console.log(`Successfully inserted ${inserted.length} mock events.`);
    console.log('\n--- TESTING INSTRUCTIONS ---');
    console.log('1. Ensure you have users with matching interests/college/bookmarks.');
    console.log('2. Ensure "Deadline Reminders" and "Email Notifications" are enabled in Profile.');
    console.log('3. Run: npm run verify:deadline-reminders');
    console.log('----------------------------\n');
  } catch (error) {
    console.error('Error seeding deadline events:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedDeadlineEvents();
