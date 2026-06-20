require('dotenv').config();

const connectDB = require('../config/db');
const Event = require('../models/Event');
const eventSeeds = require('./eventSeeds');

const seedEvents = async () => {
  try {
    await connectDB();

    await Event.deleteMany({});
    const insertedEvents = await Event.insertMany(eventSeeds);

    console.log(`Seeded ${insertedEvents.length} events successfully.`);
  } catch (error) {
    console.error('Event seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await Event.db.close();
  }
};

seedEvents();