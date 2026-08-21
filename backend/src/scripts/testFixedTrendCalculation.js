require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');

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

const startOfDayUTC = (date) => {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
};

const buildDailyTrend = (records, days = 7) => {
  const today = startOfDayUTC(new Date());
  const buckets = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = new Date(today.getTime() - index * MS_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY);
    const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });

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
    const todayStart = startOfDayUTC(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    
    console.log('=== FIXED CALCULATION TEST ===\n');
    console.log('Current time (UTC):', now.toISOString());
    console.log('Start of today (UTC):', todayStart.toISOString());
    console.log('Start of month (UTC):', monthStart.toISOString());
    
    // Test KPI calculations
    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      totalEvents,
      newEvents24h,
      newEventsMonth,
      totalNotifications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: last7d } }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      Event.countDocuments(),
      Event.countDocuments({ createdAt: { $gte: new Date(now.getTime() - MS_DAY) } }),
      Event.countDocuments({ createdAt: { $gte: monthStart } }),
      Notification.countDocuments(),
    ]);

    console.log('\n=== KPI METRICS ===');
    console.log(`Total Users: ${totalUsers}`);
    console.log(`New Users Today: ${newUsersToday}`);
    console.log(`New Users This Week: ${newUsersWeek}`);
    console.log(`New Users This Month: ${newUsersMonth}`);
    console.log(`Total Events: ${totalEvents}`);
    console.log(`New Events (24h): ${newEvents24h}`);
    console.log(`New Events This Month: ${newEventsMonth}`);
    console.log(`Total Notifications: ${totalNotifications}`);
    
    // Test trend calculations
    const eventsForTrend = await Event.find({ createdAt: { $gte: last7d } }).select('createdAt').lean();
    const usersForTrend = await User.find({ createdAt: { $gte: last7d } }).select('createdAt').lean();
    const notificationsForTrend = await Notification.find({ createdAt: { $gte: last7d } }).select('createdAt').lean();
    
    console.log(`\nRecords in last 7 days: ${eventsForTrend.length} events, ${usersForTrend.length} users, ${notificationsForTrend.length} notifications`);
    
    const eventTrend = buildDailyTrend(eventsForTrend, 7);
    console.log('\n=== EVENT TREND (Fixed) ===');
    eventTrend.forEach(day => {
      console.log(`  ${day.label}: ${day.count} events`);
    });
    
    const userTrend = buildDailyTrend(usersForTrend, 7);
    console.log('\n=== USER GROWTH TREND (Fixed) ===');
    userTrend.forEach(day => {
      console.log(`  ${day.label}: ${day.count} users`);
    });
    
    const notificationTrend = buildDailyTrend(notificationsForTrend, 7);
    console.log('\n=== NOTIFICATION ACTIVITY TREND (New) ===');
    notificationTrend.forEach(day => {
      console.log(`  ${day.label}: ${day.count} notifications`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();