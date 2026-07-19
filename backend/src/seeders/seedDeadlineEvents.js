const mongoose = require('mongoose');
require('dotenv').config();
const Event = require('../models/Event');
const connectDB = require('../config/db');

const seedDeadlineEvents = async () => {
  await connectDB();

  console.log('Clearing existing mock deadline events...');
  await Event.deleteMany({ title: { $regex: 'Mock Deadline' } });

  const now = new Date();

  const getFutureDate = (hours) => {
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  };

  const mockEvents = [
    {
      title: 'Mock Deadline - 48 Hours',
      description: 'This event will close in exactly 47 hours, triggering the 48h reminder.',
      organizer: 'Tech Club',
      college: 'Delhi Technological University',
      category: 'Hackathon',
      tags: ['hackathon', 'coding'],
      source: 'manual',
      startDate: getFutureDate(50),
      endDate: getFutureDate(74),
      registrationDeadline: getFutureDate(47), // within 48h
      mode: 'Online',
      isPublic: true,
      isVerified: true
    },
    {
      title: 'Mock Deadline - 24 Hours',
      description: 'This event will close in exactly 23 hours, triggering the 24h reminder.',
      organizer: 'Design Society',
      college: 'Delhi Technological University',
      category: 'Workshop',
      tags: ['design', 'uiux'],
      source: 'manual',
      startDate: getFutureDate(30),
      endDate: getFutureDate(34),
      registrationDeadline: getFutureDate(23), // within 24h
      mode: 'Online',
      isPublic: true,
      isVerified: true
    },
    {
      title: 'Mock Deadline - 3 Hours',
      description: 'This event will close in exactly 2 hours, triggering the 3h reminder.',
      organizer: 'Open Source Club',
      college: 'Delhi Technological University',
      category: 'Webinar',
      tags: ['opensource', 'git'],
      source: 'manual',
      startDate: getFutureDate(5),
      endDate: getFutureDate(7),
      registrationDeadline: getFutureDate(2), // within 3h
      mode: 'Online',
      isPublic: true,
      isVerified: true
    }
  ];

  try {
    const inserted = await Event.insertMany(mockEvents);
    console.log(`Successfully inserted ${inserted.length} mock events.`);
    console.log('\n--- TESTING INSTRUCTIONS ---');
    console.log('1. Ensure you have users in your database (or register a new user).');
    console.log('2. Ensure your user has "Deadline Reminders" and "Email Notifications" enabled in their Profile.');
    console.log('3. Run the cron manually by executing a test script or modifying server.js to call processDeadlineReminders() immediately on startup.');
    console.log('4. Check the terminal for email/notification logs.');
    console.log('----------------------------\n');
  } catch (error) {
    console.error('Error seeding deadline events:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedDeadlineEvents();
