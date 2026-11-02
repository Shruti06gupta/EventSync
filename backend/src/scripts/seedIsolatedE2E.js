/**
 * Isolated E2E fixtures.
 * Inserts only [E2E]-prefixed events and notifications for @eventsync-e2e.test users.
 * Does not wipe collections, send email, or trigger aggregation.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');

const E2E_EVENT_TITLE = '[E2E] Isolated Campus Hackathon';
const E2E_EVENT_LINK = 'https://example.com/e2e-isolated-campus-hackathon';
const E2E_EMAIL_SUFFIX = '@eventsync-e2e.test';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = { action: 'ensure-event' };
  for (const arg of args) {
    if (arg.startsWith('--action=')) parsed.action = arg.slice('--action='.length);
    if (arg.startsWith('--email=')) parsed.email = arg.slice('--email='.length).toLowerCase();
  }
  return parsed;
};

const ensureEvent = async () => {
  const now = Date.now();
  const payload = {
    title: E2E_EVENT_TITLE,
    description: 'Isolated EventSync E2E fixture. Safe to delete.',
    organizer: 'EventSync E2E',
    college: 'E2E Test College',
    category: 'Technology',
    tags: ['e2e', 'testing'],
    source: 'manual',
    startDate: new Date(now + 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(now + 15 * 24 * 60 * 60 * 1000),
    registrationDeadline: new Date(now + 10 * 24 * 60 * 60 * 1000),
    mode: 'Online',
    venue: 'Zoom/Online',
    image: '',
    eventLink: E2E_EVENT_LINK,
    isPublic: true,
    isVerified: true,
    isAggregated: false,
    createdBy: new mongoose.Types.ObjectId(),
  };

  const event = await Event.findOneAndUpdate(
    { title: E2E_EVENT_TITLE },
    { $set: payload },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return { eventId: String(event._id), title: event.title };
};

const notifyUser = async (email) => {
  if (!email || !email.endsWith(E2E_EMAIL_SUFFIX)) {
    throw new Error('Refusing to seed notifications for a non-isolated email');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Isolated user not found');
  }

  await Notification.deleteMany({
    user: user._id,
    message: { $regex: /^\[E2E\]/ },
  });

  const inserted = await Notification.insertMany([
    {
      user: user._id,
      message: '[E2E] New AI Hackathon added',
      type: 'new_event',
      read: false,
    },
    {
      user: user._id,
      message: '[E2E] Registration deadline tomorrow',
      type: 'deadline_reminder',
      read: false,
    },
  ]);

  return { insertedCount: inserted.length };
};

const cleanup = async () => {
  const users = await User.find({ email: { $regex: /@eventsync-e2e\.test$/i } }).select('_id');
  const userIds = users.map((user) => user._id);

  const notifications = await Notification.deleteMany({
    $or: [{ user: { $in: userIds } }, { message: { $regex: /^\[E2E\]/ } }],
  });
  const events = await Event.deleteMany({ title: { $regex: /^\[E2E\]/ } });
  const removedUsers = await User.deleteMany({ _id: { $in: userIds } });

  return {
    notifications: notifications.deletedCount,
    events: events.deletedCount,
    users: removedUsers.deletedCount,
  };
};

const run = async () => {
  const { action, email } = parseArgs();
  const ready = await connectDB();
  if (!ready) {
    throw new Error('Could not connect to MongoDB');
  }

  let result;
  if (action === 'ensure-event') {
    result = await ensureEvent();
  } else if (action === 'notify') {
    result = await notifyUser(email);
  } else if (action === 'cleanup') {
    result = await cleanup();
  } else {
    throw new Error(`Unknown action: ${action}`);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
};

run()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  });
