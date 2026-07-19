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

const buildNewEventNotificationMessage = (eventTitle, category, college, isPublic) => {
  if (isPublic) {
    return `New ${category} has been added: ${eventTitle}`;
  }
  return `New ${category} available for ${college} students: ${eventTitle}`;
};

const createEventNotifications = async ({ actorUserId, eventId, eventTitle, eventCategory, eventCollege, isPublic }) => {
  const query = { _id: { $ne: actorUserId } };
  
  if (!isPublic) {
    query.$or = [
      { interests: { $regex: new RegExp(`^${eventCategory}$`, 'i') } },
      { college: { $regex: new RegExp(`^${eventCollege}$`, 'i') } },
    ];
  }

  const recipients = await User.find(query).select('_id').lean();

  if (recipients.length === 0) {
    return { insertedCount: 0 };
  }

  const message = buildNewEventNotificationMessage(eventTitle, eventCategory, eventCollege, isPublic);

  const notifications = recipients.map((user) => ({
    user: user._id,
    type: 'new_event',
    event: eventId,
    message,
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
