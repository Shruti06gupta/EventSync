const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      required: true,
    },
    devfolioCount: {
      type: Number,
      default: 0,
    },
    unstopCount: {
      type: Number,
      default: 0,
    },
    duplicatesSkipped: {
      type: Number,
      default: 0,
    },
    errors: {
      type: [String],
      default: [],
    },
    // Detailed per-source statistics
    sourceStats: {
      devfolio: {
        fetched: { type: Number, default: 0 },
        normalized: { type: Number, default: 0 },
        duplicates: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        errors: { type: [String], default: [] }
      },
      unstop: {
        fetched: { type: Number, default: 0 },
        normalized: { type: Number, default: 0 },
        duplicates: { type: Number, default: 0 },
        inserted: { type: Number, default: 0 },
        errors: { type: [String], default: [] }
      }
    }
  },
  {
    timestamps: true,
  }
);

const SyncLog = mongoose.model('SyncLog', syncLogSchema);

module.exports = SyncLog;
