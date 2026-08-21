require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    return true;
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    return false;
  }
};

const MS_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const buildDailyTrend = (records, days = 7) => {
  const today = startOfDay(new Date());
  const buckets = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = new Date(today.getTime() - index * MS_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY);
    const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short' });

    const count = records.filter((record) => {
      const createdAt = new Date(record.createdAt);
      return createdAt >= dayStart && createdAt < dayEnd;
    }).length;

    buckets.push({ label, count });
  }

  return buckets;
};

const run = async () => {
  const isDbReady = await connectDB();
  if (!isDbReady) {
    process.exit(1);
  }

  try {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * MS_DAY);
    
    console.log('Current time:', now.toISOString());
    console.log('7 days ago:', last7d.toISOString());
    console.log('Start of today:', startOfDay(now).toISOString());
    
    // Get events for trend
    const eventsForTrend = await Event.find({ createdAt: { $gte: last7d } }).select('createdAt').lean();
    console.log(`\nEvents in last 7 days from DB: ${eventsForTrend.length}`);
    
    // Build trend
    const eventTrend = buildDailyTrend(eventsForTrend, 7);
    console.log('\nEvent Trend Calculation:');
    eventTrend.forEach(day => {
      console.log(`  ${day.label}: ${day.count} events`);
    });
    
    // Get users for trend
    const usersForTrend = await User.find({ createdAt: { $gte: last7d } }).select('createdAt').lean();
    console.log(`\nUsers in last 7 days from DB: ${usersForTrend.length}`);
    
    // Build trend
    const userTrend = buildDailyTrend(usersForTrend, 7);
    console.log('\nUser Trend Calculation:');
    userTrend.forEach(day => {
      console.log(`  ${day.label}: ${day.count} users`);
    });
    
    // Manual verification for today
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart.getTime() + MS_DAY);
    const todayEvents = await Event.countDocuments({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    });
    console.log(`\nManual check - Today's events: ${todayEvents}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();