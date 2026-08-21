require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');

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

const run = async () => {
  const isDbReady = await connectDB();
  if (!isDbReady) {
    process.exit(1);
  }

  try {
    console.log('\n=== DATABASE STATE CHECK ===\n');

    // Check users
    const totalUsers = await User.countDocuments();
    console.log(`Total Users: ${totalUsers}`);

    const recentUsers = await User.find()
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    console.log('\nRecent Users (last 10):');
    recentUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Created: ${user.createdAt}`);
    });

    // Check events
    const totalEvents = await Event.countDocuments();
    console.log(`\nTotal Events: ${totalEvents}`);

    const recentEvents = await Event.find()
      .select('title source createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    console.log('\nRecent Events (last 10):');
    recentEvents.forEach(event => {
      console.log(`  - ${event.title} (${event.source}) - Created: ${event.createdAt}`);
    });

    // Check event creation dates in last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const eventsLast7Days = await Event.find({
      createdAt: { $gte: sevenDaysAgo }
    }).select('title source createdAt').lean();

    console.log(`\nEvents created in last 7 days: ${eventsLast7Days.length}`);
    eventsLast7Days.forEach(event => {
      console.log(`  - ${event.title} (${event.source}) - Created: ${event.createdAt}`);
    });

    // Check user creation dates in last 7 days
    const usersLast7Days = await User.find({
      createdAt: { $gte: sevenDaysAgo }
    }).select('name email createdAt').lean();

    console.log(`\nUsers created in last 7 days: ${usersLast7Days.length}`);
    usersLast7Days.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Created: ${user.createdAt}`);
    });

    // Check daily breakdown for events
    console.log('\n=== DAILY EVENT CREATION (Last 7 Days) ===');
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = await Event.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });
      
      const dayName = dayStart.toLocaleDateString('en-IN', { weekday: 'short' });
      console.log(`${dayName}: ${count} events`);
    }

    // Check daily breakdown for users
    console.log('\n=== DAILY USER CREATION (Last 7 Days) ===');
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = await User.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });
      
      const dayName = dayStart.toLocaleDateString('en-IN', { weekday: 'short' });
      console.log(`${dayName}: ${count} users`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();