const cron = require('node-cron');
const Event = require('../../models/Event');
const { runAggregation } = require('./aggregation.service');
const { safeCreateDeadlineReminders } = require('../../services/notificationService');

const initScheduler = () => {
  // Deadline reminders: run everyday at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('[Scheduler] Running deadline reminders...');
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const eventsClosingTomorrow = await Event.find({
        registrationDeadline: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        isVerified: true
      });

      for (const event of eventsClosingTomorrow) {
        await safeCreateDeadlineReminders({
          eventId: event._id,
          eventTitle: event.title,
          eventCategory: event.category,
          eventTags: event.tags,
        });
      }
      console.log(`[Scheduler] Deadline reminders sent for ${eventsClosingTomorrow.length} events.`);
    } catch (error) {
      console.error('[Scheduler] Deadline reminders failed:', error.message);
    }
  });
  // Run everyday at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running automated event aggregation sync...');
    try {
      const report = await runAggregation();
      console.log(`[Scheduler] Sync complete. Status: ${report.status}. Added ${report.devfolioCount + report.unstopCount} events.`);
    } catch (error) {
      console.error('[Scheduler] Sync failed:', error.message);
    }
  });
  // Expired events cleanup: run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running expired events cleanup...');
    try {
      const now = new Date();
      // Delete events that have already ended or whose registration deadline has passed
      const result = await Event.deleteMany({
        $or: [
          { endDate: { $lt: now } },
          { registrationDeadline: { $lt: now } }
        ]
      });
      console.log(`[Scheduler] Cleanup complete. Deleted ${result.deletedCount} expired events.`);
    } catch (error) {
      console.error('[Scheduler] Cleanup failed:', error.message);
    }
  });

  console.log('Schedulers initialized.');
};

module.exports = {
  initScheduler,
};
