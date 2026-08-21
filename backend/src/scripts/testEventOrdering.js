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

const run = async () => {
  const isDbReady = await connectDB();
  if (!isDbReady) {
    process.exit(1);
  }

  try {
    console.log('=== TESTING EVENT ORDERING ===\n');
    
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    console.log('Current time:', now.toISOString());
    console.log('3 days ago:', threeDaysAgo.toISOString());
    
    // Get a valid admin user for createdBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found, creating test admin...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('TestPass123!', 10);
      adminUser = await User.create({
        name: 'Test Admin',
        email: 'test-admin@example.com',
        password: hashedPassword,
        college: 'Test College',
        role: 'admin',
      });
    }
    
    console.log(`Using admin user: ${adminUser.name} (${adminUser._id})\n`);
    
    // Create test events with different deadlines
    const testEvents = [
      {
        title: 'Event A - Closes in 6 hours',
        description: 'Test event A',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
      {
        title: 'Event B - Closes in 2 days',
        description: 'Test event B',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
      {
        title: 'Event C - Closes in 7 days',
        description: 'Test event C',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
      {
        title: 'Event D - Closed 2 hours ago',
        description: 'Test event D',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
      {
        title: 'Event E - Closed 2 days ago',
        description: 'Test event E',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
      {
        title: 'Event F - Closed 4 days ago (should be filtered)',
        description: 'Test event F',
        organizer: 'Test Organizer',
        college: 'Test College',
        category: 'Hackathon',
        tags: ['test'],
        source: 'manual',
        startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        mode: 'Online',
        venue: 'Online',
        isVerified: true,
        isPublic: true,
        isAggregated: true,
      },
    ];

    // Clean up any existing test events
    await Event.deleteMany({ title: { $regex: /Event [A-F] -/ } });
    
    // Insert test events
    const insertedEvents = await Event.insertMany(testEvents);
    console.log(`Created ${insertedEvents.length} test events\n`);

    // Test the filtering and sorting logic - only for test events
    const filter = {
      isVerified: true,
      registrationDeadline: { $gte: threeDaysAgo },
      title: { $regex: /Event [A-F] -/ }
    };

    const allEvents = await Event.find(filter);
    
    console.log('=== SORTING TEST ===\n');
    console.log(`Test events returned by filter: ${allEvents.length} events`);
    console.log('Expected: 5 events (A, B, C, D, E)');
    allEvents.forEach(event => {
      const deadline = new Date(event.registrationDeadline);
      const isOpen = deadline >= now;
      const timeUntilDeadline = isOpen ? 
        Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours' : 
        'CLOSED';
      console.log(`  ${event.title} - ${timeUntilDeadline}`);
    });

    // Apply the sorting logic
    allEvents.sort((a, b) => {
      const aDeadline = new Date(a.registrationDeadline);
      const bDeadline = new Date(b.registrationDeadline);
      const aIsOpen = aDeadline >= now;
      const bIsOpen = bDeadline >= now;

      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      if (aIsOpen && bIsOpen) {
        return aDeadline.getTime() - bDeadline.getTime();
      }

      if (!aIsOpen && !bIsOpen) {
        return bDeadline.getTime() - aDeadline.getTime();
      }

      return 0;
    });

    console.log('\nAfter sorting:');
    allEvents.forEach(event => {
      const deadline = new Date(event.registrationDeadline);
      const isOpen = deadline >= now;
      const timeUntilDeadline = isOpen ? 
        Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours' : 
        'CLOSED';
      console.log(`  ${event.title} - ${timeUntilDeadline}`);
    });

    // Verify expected order
    const expectedOrder = ['Event A - Closes in 6 hours', 'Event B - Closes in 2 days', 'Event C - Closes in 7 days', 'Event D - Closed 2 hours ago', 'Event E - Closed 2 days ago'];
    const actualOrder = allEvents.map(e => e.title);
    
    console.log('\n=== VERIFICATION ===\n');
    console.log('Expected order:', expectedOrder);
    console.log('Actual order:', actualOrder);
    
    const isCorrect = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);
    console.log(`Sorting is ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    // Test cleanup scheduler logic - only for test events
    console.log('\n=== CLEANUP SCHEDULER TEST ===\n');
    const cleanupFilter = { 
      registrationDeadline: { $lt: threeDaysAgo },
      title: { $regex: /Event [A-F] -/ }
    };
    const eventsToRemove = await Event.countDocuments(cleanupFilter);
    console.log(`Test events that should be removed (closed > 3 days): ${eventsToRemove}`);
    console.log('Expected: 1 (Event F)');
    console.log(`Cleanup is ${eventsToRemove === 1 ? 'CORRECT' : 'INCORRECT'}`);

    // Clean up test events
    await Event.deleteMany({ title: { $regex: /Event [A-F] -/ } });
    console.log('\nTest events cleaned up');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();