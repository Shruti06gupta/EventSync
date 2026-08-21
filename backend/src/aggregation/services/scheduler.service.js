const cron = require('node-cron');
const Event = require('../../models/Event');
const { runAggregation } = require('./aggregation.service');

const initScheduler = () => {
  // Run everyday at 9:00 AM IST (UTC+5:30 = 3:30 AM UTC)
  cron.schedule('30 3 * * *', async () => {
    console.log('[Scheduler] Running automated event aggregation sync...');
    try {
      const report = await runAggregation('system');
      console.log(`[Scheduler] Sync complete. Status: ${report.status}. Added ${report.devfolioCount + report.unstopCount} events.`);
    } catch (error) {
      console.error('[Scheduler] Sync failed:', error.message);
    }
  });
  
  // Expired events cleanup: run every hour at minute 0
  // Remove events closed for more than 3 days
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running expired events cleanup...');
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      // Delete events whose registration deadline has passed by more than 3 days
      const result = await Event.deleteMany({
        registrationDeadline: { $lt: threeDaysAgo }
      });
      
      console.log(`[Scheduler] Cleanup complete. Deleted ${result.deletedCount} events closed for more than 3 days.`);
    } catch (error) {
      console.error('[Scheduler] Cleanup failed:', error.message);
    }
  });

  console.log('Schedulers initialized.');
};

module.exports = {
  initScheduler,
};
