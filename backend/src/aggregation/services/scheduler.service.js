const cron = require('node-cron');
const Event = require('../../models/Event');
const SyncLog = require('../../models/SyncLog');
const { runAggregation } = require('./aggregation.service');

const initScheduler = () => {
  // Run every 6 hours at :30 (03:30, 09:30, 15:30, 21:30 UTC = 9:00 AM, 3:00 PM, 9:00 PM, 3:00 AM IST)
  cron.schedule('30 3,9,15,21 * * *', async () => {
    console.log('[Scheduler] Running automated event aggregation sync...');
    try {
      const report = await runAggregation('system');
      if (report && !report.isAlreadyRunning) {
        console.log(
          `[Scheduler] Sync complete. Status: ${report.status}. Added ${report.devfolioCount + report.unstopCount} events.`
        );
      }
    } catch (error) {
      console.error('[Scheduler] Sync failed:', error.message);
    }
  });

  // Check if a sync is overdue on startup (e.g. server was off or last sync > 6 hours ago)
  const checkOverdueSync = async () => {
    try {
      const lastSync = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      if (!lastSync || new Date(lastSync.createdAt) < sixHoursAgo) {
        console.log('[Scheduler] Sync is overdue (> 6 hours). Running automated catch-up sync...');
        // Wait 3 seconds for server connections to fully settle
        setTimeout(async () => {
          try {
            await runAggregation('system');
          } catch (err) {
            console.error('[Scheduler] Catch-up sync error:', err.message);
          }
        }, 3000);
      } else {
        console.log(`[Scheduler] Recent sync found (${new Date(lastSync.createdAt).toISOString()}). Next scheduled slot active.`);
      }
    } catch (e) {
      console.warn('[Scheduler] Could not verify last sync timestamp:', e.message);
    }
  };

  checkOverdueSync();

  // Expired events cleanup: run every hour at minute 0
  // Remove events closed for more than 3 days
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running expired events cleanup...');
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Delete events whose registration deadline has passed by more than 3 days
      const result = await Event.deleteMany({
        registrationDeadline: { $lt: threeDaysAgo },
      });

      console.log(`[Scheduler] Cleanup complete. Deleted ${result.deletedCount} events closed for more than 3 days.`);
    } catch (error) {
      console.error('[Scheduler] Cleanup failed:', error.message);
    }
  });

  console.log('Schedulers initialized: Event auto-sync runs every 6 hours (03:30, 09:30, 15:30, 21:30 UTC) + overdue catch-up.');
};

module.exports = {
  initScheduler,
};
