const cron = require('node-cron');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ReminderLog = require('../models/ReminderLog');
const sendEmail = require('../utils/email');
const { generateDeadlineEmail } = require('../utils/emailTemplates');

const STAGES = {
  '48h': 48 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000
};

// Find events closing within the stage timeframes
const getApproachingEvents = async (now) => {
  const events = await Event.find({
    registrationDeadline: { $gt: now },
    isVerified: true
  }).lean();
  
  const categorizedEvents = { '48h': [], '24h': [], '3h': [] };
  
  events.forEach(event => {
    const timeToDeadline = new Date(event.registrationDeadline).getTime() - now.getTime();
    
    // Assign to the most urgent stage that has passed its threshold, assuming we check hourly
    if (timeToDeadline <= STAGES['3h'] && timeToDeadline > 0) {
      categorizedEvents['3h'].push(event);
    } else if (timeToDeadline <= STAGES['24h'] && timeToDeadline > STAGES['24h'] - (60 * 60 * 1000)) { // roughly within the 24h window
      categorizedEvents['24h'].push(event);
    } else if (timeToDeadline <= STAGES['48h'] && timeToDeadline > STAGES['48h'] - (60 * 60 * 1000)) { // roughly within the 48h window
      categorizedEvents['48h'].push(event);
    }
    // Alternatively, a safer approach to catch missed crons is checking if it's strictly less than stage time, 
    // but the ReminderLog will prevent duplicates.
  });

  return categorizedEvents;
};

// Safer categorisation relying on ReminderLog
const getEventsWithStages = async (now) => {
  const events = await Event.find({
    registrationDeadline: { $gt: now },
    isVerified: true
  }).lean();

  const stagedEvents = [];
  events.forEach(event => {
    const timeToDeadline = new Date(event.registrationDeadline).getTime() - now.getTime();
    if (timeToDeadline <= STAGES['3h']) {
      stagedEvents.push({ event, stage: '3h' });
    } else if (timeToDeadline <= STAGES['24h']) {
      stagedEvents.push({ event, stage: '24h' });
    } else if (timeToDeadline <= STAGES['48h']) {
      stagedEvents.push({ event, stage: '48h' });
    }
  });
  return stagedEvents;
}

const getEligibleUsers = async (event) => {
  // Priority 1: Bookmarks
  // Priority 2: Interests
  // Priority 3: College
  // Priority 4: isPublic
  
  const query = {
    $or: [
      { bookmarks: event._id }
    ]
  };

  if (!event.isPublic) {
    query.$or.push({ interests: { $regex: new RegExp(`^${event.category}$`, 'i') } });
    query.$or.push({ college: { $regex: new RegExp(`^${event.college}$`, 'i') } });
  } else {
    // If public, theoretically all users, but we should limit to users who might be interested to avoid spam, 
    // or if public means "notify everyone", we can do an empty filter. But requirements say:
    // "Do NOT notify every user for every event."
    // "Admin marked the event as Featured/Public -> eligible". 
    // Okay, if it's public, maybe notify all users? The prompt says "A reminder should ONLY be sent if at least one of these conditions is true: ... Admin marked event as Featured/Public."
    // So if isPublic, we notify all.
    delete query.$or;
  }

  // Find users who have not opted out of deadline reminders
  const users = await User.find(query).lean();
  
  return users.filter(u => {
    // Check if user has notificationPreferences defined, default to true
    if (u.notificationPreferences && u.notificationPreferences.deadlineReminders === false) {
      return false;
    }
    return true;
  });
};

const processDeadlineReminders = async () => {
  try {
    console.log('[Cron] Starting Deadline Reminder Job...');
    const now = new Date();
    const stagedEvents = await getEventsWithStages(now);
    
    let emailsSent = 0;
    let notificationsCreated = 0;
    let duplicatesSkipped = 0;

    for (const { event, stage } of stagedEvents) {
      const eligibleUsers = await getEligibleUsers(event);
      
      if (eligibleUsers.length === 0) continue;

      for (const user of eligibleUsers) {
        // Check if reminder already sent
        const existingLog = await ReminderLog.findOne({ user: user._id, event: event._id, stage });
        if (existingLog) {
          duplicatesSkipped++;
          continue;
        }

        // In-app Notification
        const message = stage === '3h' ? `🚨 Last 3 hours to register for ${event.title}` 
                     : stage === '24h' ? `⚠ Registration for ${event.title} closes tomorrow` 
                     : `⏰ Registration for ${event.title} closes in 48 hours`;

        try {
          await Notification.create({
            user: user._id,
            message,
            type: 'deadline_reminder',
            reminderStage: stage,
            event: event._id
          });
          notificationsCreated++;
        } catch (err) {
          console.error(`[Cron] Error creating notification for user ${user._id}:`, err.message);
          continue; // skip logging and email if notification failed entirely
        }

        // Email Notification
        if (!user.notificationPreferences || user.notificationPreferences.email !== false) {
          const emailContent = generateDeadlineEmail(event, stage, user);
          try {
            await sendEmail({
              to: user.email,
              subject: emailContent.subject,
              html: emailContent.html
            });
            emailsSent++;
          } catch (err) {
            console.error(`[Cron] Error sending email to ${user.email}:`, err.message);
            // Even if email fails, we continue (as per requirements)
          }
        }

        // Save Reminder Log
        await ReminderLog.create({ user: user._id, event: event._id, stage });
      }
    }

    console.log(`[Cron] Job completed. Notifications: ${notificationsCreated}, Emails: ${emailsSent}, Skipped: ${duplicatesSkipped}`);
  } catch (error) {
    console.error('[Cron] Fatal error in deadline reminder job:', error);
  }
};

const initDeadlineCron = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', processDeadlineReminders);
  console.log('Deadline Reminder Cron Job initialized.');
};

module.exports = {
  initDeadlineCron,
  processDeadlineReminders // exported for testing
};
