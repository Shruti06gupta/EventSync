const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    organizer: {
      type: String,
      required: [true, 'Organizer is required'],
      trim: true,
    },
    college: {
      type: String,
      required: [true, 'College is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      enum: ['devfolio', 'unstop', 'manual'],
      default: 'manual',
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate;
        },
        message: 'End date must be after or equal to start date',
      },
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Registration deadline is required'],
      validate: {
        validator: function (value) {
          return !this.startDate || value <= this.startDate;
        },
        message: 'Registration deadline cannot be after the event start date.',
      },
    },
    mode: {
      type: String,
      enum: ['Online', 'Offline', 'Hybrid'],
      required: [true, 'Mode is required'],
    },
    venue: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    eventLink: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true;
          try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol);
          } catch (e) {
            return false;
          }
        },
        message: 'Event link must be a valid URL starting with http:// or https://',
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isAggregated: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() { return !this.isAggregated; },
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ isVerified: 1, registrationDeadline: 1 });
eventSchema.index({ college: 1, category: 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
