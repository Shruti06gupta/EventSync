const { runAggregation, isSyncActive } = require('../aggregation/services/aggregation.service');
const SyncLog = require('../models/SyncLog');

const triggerSync = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can trigger synchronization' });
    }

    const report = await runAggregation(req.user._id);

    if (report && report.isAlreadyRunning) {
      return res.status(200).json({
        message: 'Synchronization is already running in the background',
        report: {
          status: 'running',
          devfolioCount: 0,
          unstopCount: 0,
          duplicatesSkipped: 0,
        },
      });
    }

    return res.status(200).json({
      message: 'Synchronization completed successfully',
      report,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Synchronization failed',
      error: error.message,
    });
  }
};

const getNextScheduledSyncDate = (now = new Date()) => {
  const candidateSlots = [];
  for (const h of [3, 9, 15, 21]) {
    const slotToday = new Date(now);
    slotToday.setUTCHours(h, 30, 0, 0);
    if (slotToday > now) {
      candidateSlots.push(slotToday);
    }
    const slotTomorrow = new Date(now);
    slotTomorrow.setUTCDate(slotTomorrow.getUTCDate() + 1);
    slotTomorrow.setUTCHours(h, 30, 0, 0);
    candidateSlots.push(slotTomorrow);
  }
  candidateSlots.sort((a, b) => a.getTime() - b.getTime());
  return candidateSlots[0];
};

const getSyncStatus = async (req, res) => {
  try {
    const lastSync = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
    const nextSync = getNextScheduledSyncDate();
    const isRunning = isSyncActive();

    if (!lastSync) {
      return res.status(200).json({
        hasSyncHistory: false,
        isRunning,
        message: 'No sync history available',
        nextScheduledSync: nextSync,
        schedule: 'Every 6 hours (9:00 AM, 3:00 PM, 9:00 PM, 3:00 AM IST)',
      });
    }

    return res.status(200).json({
      hasSyncHistory: true,
      isRunning,
      lastSync: {
        status: lastSync.status,
        timestamp: lastSync.createdAt,
        devfolioCount: lastSync.devfolioCount,
        unstopCount: lastSync.unstopCount,
        duplicatesSkipped: lastSync.duplicatesSkipped,
        errors: lastSync.errors,
        totalEventsAdded: lastSync.devfolioCount + lastSync.unstopCount,
        sourceStats: lastSync.sourceStats || null,
      },
      nextScheduledSync: nextSync,
      schedule: 'Every 6 hours (9:00 AM, 3:00 PM, 9:00 PM, 3:00 AM IST)',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get sync status',
      error: error.message,
    });
  }
};

module.exports = {
  triggerSync,
  getSyncStatus,
};
