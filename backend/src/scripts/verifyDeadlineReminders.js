process.env.EMAIL_DRY_RUN = 'true';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const ReminderLog = require('../models/ReminderLog');
const connectDB = require('../config/db');
const emailService = require('../utils/emailService');
const { getValidatedUserEmail, isEligibleForDeadlineReminders } = require('../utils/notificationRecipients');

const capturedEmails = [];
const originalSendEmail = emailService.sendEmail.bind(emailService);
emailService.sendEmail = async (payload) => {
  capturedEmails.push(payload);
  return originalSendEmail(payload);
};

const {
  processDeadlineReminders,
  getReminderStage,
} = require('./deadlineCron');

const TEST_PREFIX = 'deadline-reminder-test';
const ts = Date.now();

const emails = {
  valid: `${TEST_PREFIX}-valid-${ts}@example.com`,
  invalid: 'not-a-valid-email',
  optedOut: `${TEST_PREFIX}-optout-${ts}@example.com`,
};

const eventTitles = {
  weekly: `${TEST_PREFIX}-weekly-${ts}`,
  daily24: `${TEST_PREFIX}-24h-${ts}`,
  sixHour: `${TEST_PREFIX}-6h-${ts}`,
  fortyEight: `${TEST_PREFIX}-48h-${ts}`,
};

let passed = 0;
let failed = 0;

const assert = (name, condition, detail = '') => {
  if (condition) {
    console.log(`PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
};

const hoursFromNow = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);

const createEvent = async (title, registrationDeadlineHours, createdBy, category = 'qa-reminders') =>
  Event.create({
    title,
    description: 'Deadline reminder verification event',
    organizer: 'EventSync QA',
    college: 'EventSync QA College',
    category,
    tags: ['qa-reminders'],
    source: 'manual',
    startDate: hoursFromNow(registrationDeadlineHours + 2),
    endDate: hoursFromNow(registrationDeadlineHours + 6),
    registrationDeadline: hoursFromNow(registrationDeadlineHours),
    mode: 'Online',
    isPublic: true,
    isVerified: true,
    createdBy,
  });

const cleanup = async () => {
  const users = await User.find({ email: { $in: Object.values(emails) } }).select('_id email').lean();
  const userIds = users.map((user) => user._id);
  const events = await Event.find({ title: { $regex: TEST_PREFIX } }).select('_id').lean();
  const eventIds = events.map((event) => event._id);

  await Notification.deleteMany({ user: { $in: userIds } });
  await ReminderLog.deleteMany({ user: { $in: userIds } });
  await Event.deleteMany({ _id: { $in: eventIds } });
  await User.deleteMany({ _id: { $in: userIds } });
};

const setupUsersAndEvents = async () => {
  const [validUser, invalidUser, optedOutUser] = await User.create([
    {
      name: 'Valid Reminder User',
      email: emails.valid,
      password: 'Passw0rd!',
      college: 'EventSync QA College',
      interests: ['qa-reminders'],
      notificationPreferences: { email: true, deadlineReminders: true },
    },
    {
      name: 'Invalid Email User',
      email: emails.invalid,
      password: 'Passw0rd!',
      college: 'EventSync QA College',
      interests: ['qa-reminders'],
      notificationPreferences: { email: true, deadlineReminders: true },
    },
    {
      name: 'Opted Out User',
      email: emails.optedOut,
      password: 'Passw0rd!',
      college: 'EventSync QA College',
      interests: ['qa-reminders'],
      notificationPreferences: { email: true, deadlineReminders: false },
    },
  ]);

  const weeklyEvent = await createEvent(eventTitles.weekly, 7 * 24, validUser._id);
  const event24h = await createEvent(eventTitles.daily24, 24, validUser._id);
  const event6h = await createEvent(eventTitles.sixHour, 6, validUser._id);
  const event48h = await createEvent(eventTitles.fortyEight, 48, validUser._id);

  return { validUser, invalidUser, optedOutUser, weeklyEvent, event24h, event6h, event48h };
};

const countReminders = async (userId, eventId, stage) => {
  const [logs, notifications] = await Promise.all([
    ReminderLog.countDocuments({ user: userId, event: eventId, stage }),
    Notification.countDocuments({ user: userId, event: eventId, reminderStage: stage, type: 'deadline_reminder' }),
  ]);

  return { logs, notifications };
};

const run = async () => {
  const isDbReady = await connectDB();
  if (!isDbReady) {
    console.error('Could not connect to MongoDB');
    process.exit(1);
  }

  await cleanup();
  capturedEmails.length = 0;

  try {
    const {
      validUser,
      invalidUser,
      optedOutUser,
      weeklyEvent,
      event24h,
      event6h,
      event48h,
    } = await setupUsersAndEvents();

    const testEventIds = [weeklyEvent._id, event24h._id, event6h._id, event48h._id];
    const runForTestEvents = () => processDeadlineReminders({ eventIds: testEventIds });

    assert('Stage detection: weekly window', getReminderStage(7 * 24 * 60 * 60 * 1000) === 'weekly');
    assert('Stage detection: 24h window', getReminderStage(24 * 60 * 60 * 1000) === '24h');
    assert('Stage detection: 6h window', getReminderStage(6 * 60 * 60 * 1000) === '6h');
    assert('Stage detection: 48h has no reminder', getReminderStage(48 * 60 * 60 * 1000) === null);
    assert('Invalid format email is rejected', !getValidatedUserEmail({ email: emails.invalid }).valid);
    assert('Valid format email passes validation', getValidatedUserEmail({ email: emails.valid }).valid);
    assert('Opted-out user is ineligible', !isEligibleForDeadlineReminders(optedOutUser));

    await runForTestEvents();

    const weeklyCounts = await countReminders(validUser._id, weeklyEvent._id, 'weekly');
    assert('TEST 1: weekly reminder sent', weeklyCounts.logs === 1 && weeklyCounts.notifications === 1);

    await runForTestEvents();
    const weeklyCountsAfter = await countReminders(validUser._id, weeklyEvent._id, 'weekly');
    assert('TEST 2: weekly reminder not duplicated', weeklyCountsAfter.logs === 1 && weeklyCountsAfter.notifications === 1);

    const counts24h = await countReminders(validUser._id, event24h._id, '24h');
    assert('TEST 3: 24h reminder sent', counts24h.logs === 1 && counts24h.notifications === 1);

    await runForTestEvents();
    const counts24hAfter = await countReminders(validUser._id, event24h._id, '24h');
    assert('TEST 4: 24h reminder not duplicated', counts24hAfter.logs === 1 && counts24hAfter.notifications === 1);

    const counts6h = await countReminders(validUser._id, event6h._id, '6h');
    assert('TEST 5: 6h reminder sent', counts6h.logs === 1 && counts6h.notifications === 1);

    await runForTestEvents();
    const counts6hAfter = await countReminders(validUser._id, event6h._id, '6h');
    assert('TEST 6: 6h reminder not duplicated', counts6hAfter.logs === 1 && counts6hAfter.notifications === 1);

    const counts48h = await countReminders(validUser._id, event48h._id, 'weekly');
    const counts48h24 = await countReminders(validUser._id, event48h._id, '24h');
    const counts48h6 = await countReminders(validUser._id, event48h._id, '6h');
    assert(
      'TEST 7: 48h away sends no reminder',
      counts48h.logs === 0 && counts48h24.logs === 0 && counts48h6.logs === 0
    );

    const totalWeeklyLogs = await ReminderLog.countDocuments({
      user: validUser._id,
      event: weeklyEvent._id,
      stage: 'weekly',
    });
    assert('TEST 8: only one weekly log per user/event/stage', totalWeeklyLogs === 1);

    const invalidWeekly = await countReminders(invalidUser._id, weeklyEvent._id, 'weekly');
    assert(
      'TEST 9: invalid-format email skips SMTP send',
      invalidWeekly.notifications === 1 && capturedEmails.every((entry) => entry.to !== emails.invalid)
    );

    const validTotal = await ReminderLog.countDocuments({ user: validUser._id });
    assert('TEST 10: valid user receives configured reminders', validTotal >= 3);

    const optedOutWeekly = await countReminders(optedOutUser._id, weeklyEvent._id, 'weekly');
    const optedOut24h = await countReminders(optedOutUser._id, event24h._id, '24h');
    assert(
      'TEST 11: opted-out user receives no reminders',
      optedOutWeekly.logs === 0 && optedOutWeekly.notifications === 0 &&
      optedOut24h.logs === 0 && optedOut24h.notifications === 0
    );

    assert(
      'TEST 12: captured emails use only intended valid recipient',
      capturedEmails.length >= 3 && capturedEmails.every((entry) => entry.to === emails.valid)
    );

    assert(
      'TEST 13: captured emails include EventSync HTML content',
      capturedEmails.every((entry) => typeof entry.html === 'string' && entry.html.includes('EventSync'))
    );
  } finally {
    emailService.sendEmail = originalSendEmail;
    await cleanup();
    await mongoose.connection.close();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
