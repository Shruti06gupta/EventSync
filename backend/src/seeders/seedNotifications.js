require('dotenv').config();

const connectDB = require('../config/db');
const Notification = require('../models/Notification');
const { seedNotifications } = require('./notificationSeeds');

const run = async () => {
  try {
    await connectDB();

    const result = await seedNotifications();
    console.log(`Seeded ${result.insertedCount} notifications successfully.`);
    if (result.message) {
      console.log(result.message);
    }
  } catch (error) {
    console.error('Notification seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await Notification.db.close();
  }
};

run();
