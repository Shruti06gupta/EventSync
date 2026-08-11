const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: ['weekly', '24h', '6h'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reminders for the same user, event, and stage
reminderLogSchema.index({ user: 1, event: 1, stage: 1 }, { unique: true });

const ReminderLog = mongoose.model('ReminderLog', reminderLogSchema);

module.exports = ReminderLog;
