const { runAggregation } = require('../aggregation/services/aggregation.service');
const SyncLog = require('../models/SyncLog');

const triggerSync = async (req, res) => {
  try {
    // Ensure only admins can trigger this (middleware usually handles this, but good to be safe)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can trigger synchronization' });
    }

    const report = await runAggregation(req.user._id);

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

const getSyncStatus = async (req, res) => {
  try {
    // Get the most recent sync log
    const lastSync = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
    
    if (!lastSync) {
      return res.status(200).json({
        hasSyncHistory: false,
        message: 'No sync history available',
      });
    }

    // Calculate next scheduled sync (9:00 AM IST = 3:30 AM UTC)
    const now = new Date();
    const nextSync = new Date(now);
    nextSync.setUTCHours(3, 30, 0, 0);
    if (nextSync <= now) {
      nextSync.setUTCDate(nextSync.getUTCDate() + 1);
    }

    return res.status(200).json({
      hasSyncHistory: true,
      lastSync: {
        status: lastSync.status,
        timestamp: lastSync.createdAt,
        devfolioCount: lastSync.devfolioCount,
        unstopCount: lastSync.unstopCount,
        duplicatesSkipped: lastSync.duplicatesSkipped,
        errors: lastSync.errors,
        totalEventsAdded: lastSync.devfolioCount + lastSync.unstopCount,
      },
      nextScheduledSync: nextSync,
      schedule: 'Daily at 9:00 AM IST',
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
