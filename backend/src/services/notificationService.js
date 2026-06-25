const Notification = require('../models/Notification');
const User = require('../models/User');

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;

const normalizeNotificationLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(parsed, MAX_NOTIFICATION_LIMIT);
};

const buildNewEventNotificationMessage = (eventTitle) => `New event available: ${eventTitle}`;

const createEventNotifications = async ({ actorUserId, eventId, eventTitle }) => {
  const recipients = await User.find({ _id: { $ne: actorUserId } }).select('_id').lean();

  if (recipients.length === 0) {
    return { insertedCount: 0 };
  }

  const notifications = recipients.map((user) => ({
    user: user._id,
    type: 'event_created',
    event: eventId,
    message: buildNewEventNotificationMessage(eventTitle),
  }));

  const inserted = await Notification.insertMany(notifications);

  return { insertedCount: inserted.length };
};

const getUnreadNotificationCount = (userId) =>
  Notification.countDocuments({
    user: userId,
    read: false,
  });

module.exports = {
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_LIMIT,
  normalizeNotificationLimit,
  buildNewEventNotificationMessage,
  createEventNotifications,
  getUnreadNotificationCount,
};
