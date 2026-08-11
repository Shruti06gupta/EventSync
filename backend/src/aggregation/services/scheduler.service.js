const cron = require('node-cron');
const Event = require('../../models/Event');
const { runAggregation } = require('./aggregation.service');

const initScheduler = () => {
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
