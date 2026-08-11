const cron = require('node-cron');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ReminderLog = require('../models/ReminderLog');
const sendEmail = require('../utils/emailService').sendEmail;
const { generateDeadlineEmail } = require('../utils/emailTemplates');
const {
  getValidatedUserEmail,
  hasDeadlineRemindersEnabled,
  hasEmailNotificationsEnabled,
} = require('../utils/notificationRecipients');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const REMINDER_WINDOWS = [
  { stage: '6h', minMs: 5 * HOUR_MS, maxMs: 7 * HOUR_MS },
  { stage: '24h', minMs: 23 * HOUR_MS, maxMs: 25 * HOUR_MS },
  { stage: 'weekly', minMs: 6 * DAY_MS, maxMs: 7.5 * DAY_MS },
];

const logReminderAttempt = ({ eventId, userId, stage, recipient, status, reason = null }) => {
  const details = [
    `[Reminder] event=${eventId}`,
    `user=${userId}`,
    `type=${stage}`,
    `recipient=${recipient || 'none'}`,
    `status=${status}`,
  ];

  if (reason) {
    details.push(`reason=${reason}`);
  }

  console.log(details.join(' '));
};

const getReminderStage = (timeToDeadlineMs) => {
  if (timeToDeadlineMs <= 0) {
    return null;
  }

  for (const window of REMINDER_WINDOWS) {
    if (timeToDeadlineMs > window.minMs && timeToDeadlineMs <= window.maxMs) {
      return window.stage;
    }
  }

  return null;
};

const getEventsWithStages = async (now, eventIds = null) => {
  const query = {
    registrationDeadline: { $gt: now },
    isVerified: true,
  };

  if (Array.isArray(eventIds) && eventIds.length > 0) {
    query._id = { $in: eventIds };
  }

  const events = await Event.find(query).lean();
  const stagedEvents = [];

  events.forEach((event) => {
    const timeToDeadline = new Date(event.registrationDeadline).getTime() - now.getTime();
    const stage = getReminderStage(timeToDeadline);

    if (stage) {
      stagedEvents.push({ event, stage });
    }
  });

  return stagedEvents;
};

const getEligibleUsers = async (event) => {
  const query = {
    $or: [{ bookmarks: event._id }],
  };

  if (event.category) {
    query.$or.push({ interests: { $regex: new RegExp(`^${event.category}$`, 'i') } });
  }

  if (event.college) {
    query.$or.push({ college: { $regex: new RegExp(`^${event.college}$`, 'i') } });
  }

  return User.find(query)
    .select('_id name email notificationPreferences')
    .lean();
};

const buildReminderMessage = (eventTitle, stage) => {
  if (stage === '6h') {
    return `Reminder: ${eventTitle} registration closes in 6 hours`;
  }

  if (stage === '24h') {
    return `Reminder: ${eventTitle} registration closes in 24 hours`;
  }

  return `Reminder: ${eventTitle} registration closes in 1 week`;
};

const ensureInAppNotification = async (userId, event, stage) => {
  const existingNotification = await Notification.findOne({
    user: userId,
    event: event._id,
    type: 'deadline_reminder',
    reminderStage: stage,
  }).lean();

  if (existingNotification) {
    return false;
  }

  await Notification.create({
    user: userId,
    message: buildReminderMessage(event.title, stage),
    type: 'deadline_reminder',
    reminderStage: stage,
    event: event._id,
  });

  return true;
};

const markReminderComplete = async (userId, eventId, stage) => {
  try {
    await ReminderLog.create({ user: userId, event: eventId, stage });
    return true;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }
    throw error;
  }
};

const processDeadlineReminders = async (options = {}) => {
  try {
    console.log('[Cron] Starting Deadline Reminder Job...');
    const now = new Date();
    const stagedEvents = await getEventsWithStages(now, options.eventIds);

    let emailsSent = 0;
    let notificationsCreated = 0;
    let duplicatesSkipped = 0;
    let invalidRecipientsSkipped = 0;
    let emailFailures = 0;

    for (const { event, stage } of stagedEvents) {
      const eligibleUsers = await getEligibleUsers(event);
      const seenRecipients = new Set();

      if (eligibleUsers.length === 0) {
        continue;
      }

      for (const user of eligibleUsers) {
        const existingLog = await ReminderLog.findOne({
          user: user._id,
          event: event._id,
          stage,
        }).lean();

        if (existingLog) {
          duplicatesSkipped += 1;
          continue;
        }

        if (!hasDeadlineRemindersEnabled(user)) {
          logReminderAttempt({
            eventId: event._id,
            userId: user._id,
            stage,
            recipient: user.email,
            status: 'skipped',
            reason: 'deadline reminders disabled',
          });
          continue;
        }

        const freshUser = await User.findById(user._id)
          .select('_id name email notificationPreferences')
          .lean();

        if (!freshUser) {
          continue;
        }

        const { email: recipientEmail, valid, reason } = getValidatedUserEmail(freshUser);
        const recipientKey = recipientEmail ? recipientEmail.toLowerCase() : null;

        if (recipientKey && seenRecipients.has(recipientKey)) {
          logReminderAttempt({
            eventId: event._id,
            userId: freshUser._id,
            stage,
            recipient: recipientEmail,
            status: 'skipped',
            reason: 'duplicate recipient in current batch',
          });
          await markReminderComplete(freshUser._id, event._id, stage);
          continue;
        }

        if (recipientKey) {
          seenRecipients.add(recipientKey);
        }

        const notificationCreated = await ensureInAppNotification(freshUser._id, event, stage);
        if (notificationCreated) {
          notificationsCreated += 1;
        }

        if (!hasEmailNotificationsEnabled(freshUser)) {
          logReminderAttempt({
            eventId: event._id,
            userId: freshUser._id,
            stage,
            recipient: recipientEmail,
            status: 'skipped',
            reason: 'email notifications disabled',
          });
          await markReminderComplete(freshUser._id, event._id, stage);
          continue;
        }

        if (!valid) {
          invalidRecipientsSkipped += 1;
          logReminderAttempt({
            eventId: event._id,
            userId: freshUser._id,
            stage,
            recipient: freshUser.email,
            status: 'skipped',
            reason,
          });
          await markReminderComplete(freshUser._id, event._id, stage);
          continue;
        }

        const emailContent = generateDeadlineEmail(event, stage, freshUser);

        try {
          const emailResult = await sendEmail({
            to: recipientEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });

          if (emailResult.status !== 'sent') {
            emailFailures += 1;
            logReminderAttempt({
              eventId: event._id,
              userId: freshUser._id,
              stage,
              recipient: recipientEmail,
              status: 'skipped',
              reason: emailResult.reason || 'email not sent',
            });
            continue;
          }

          const logged = await markReminderComplete(freshUser._id, event._id, stage);
          if (!logged) {
            duplicatesSkipped += 1;
            continue;
          }

          emailsSent += 1;
          logReminderAttempt({
            eventId: event._id,
            userId: freshUser._id,
            stage,
            recipient: recipientEmail,
            status: 'sent',
          });
        } catch (error) {
          emailFailures += 1;
          logReminderAttempt({
            eventId: event._id,
            userId: freshUser._id,
            stage,
            recipient: recipientEmail,
            status: 'failed',
            reason: error.message,
          });
        }
      }
    }

    console.log(
      `[Cron] Job completed. Notifications: ${notificationsCreated}, Emails: ${emailsSent}, Duplicates skipped: ${duplicatesSkipped}, Invalid recipients skipped: ${invalidRecipientsSkipped}, Email failures: ${emailFailures}`
    );
  } catch (error) {
    console.error('[Cron] Fatal error in deadline reminder job:', error);
  }
};

const initDeadlineCron = () => {
  cron.schedule('0 * * * *', processDeadlineReminders);
  console.log('Deadline Reminder Cron Job initialized.');
};

module.exports = {
  initDeadlineCron,
  processDeadlineReminders,
  getReminderStage,
  REMINDER_WINDOWS,
};
