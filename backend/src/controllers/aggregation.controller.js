const { runAggregation } = require('../aggregation/services/aggregation.service');

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

module.exports = {
  triggerSync,
};
