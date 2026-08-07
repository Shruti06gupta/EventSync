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

const buildBookmarkNotificationMessage = (eventTitle) => `You bookmarked: ${eventTitle}`;

const safeCreateNotifications = async (operation, context = {}) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Notification creation failed:', {
      ...context,
      error: error.message,
    });

    return {
      insertedCount: 0,
      error: error.message,
    };
  }
};

const createEventNotifications = async ({ actorUserId, eventId, eventTitle, eventCategory, eventTags }) => {
  const recipients = await User.find({ _id: { $ne: actorUserId } }).select('_id interests').lean();

  if (recipients.length === 0) {
    return { insertedCount: 0 };
  }

  const eventInterests = [eventCategory, ...(eventTags || [])]
    .filter(Boolean)
    .map((value) => value.trim().toLowerCase());

  const matchingRecipients = recipients.filter((user) => {
    if (eventInterests.length === 0) return false;
    const userInterests = (user.interests || []).map((value) => value.trim().toLowerCase());
    return userInterests.some((interest) => eventInterests.includes(interest));
  });

  if (matchingRecipients.length === 0) {
    return { insertedCount: 0 };
  }

  const notifications = matchingRecipients.map((user) => ({
    user: user._id,
    type: 'event_created',
    event: eventId,
    message: buildNewEventNotificationMessage(eventTitle),
  }));

  const inserted = await Notification.insertMany(notifications);

  return { insertedCount: inserted.length };
};

const safeCreateEventNotifications = (payload) =>
  safeCreateNotifications(
    () => createEventNotifications(payload),
    {
      type: 'event_created',
      actorUserId: payload.actorUserId,
      eventId: payload.eventId,
    }
  );

const createBookmarkNotification = async ({ userId, eventId, eventTitle }) => {
  const notification = {
    user: userId,
    type: 'bookmark_added',
    event: eventId,
    message: buildBookmarkNotificationMessage(eventTitle),
  };

  const inserted = await Notification.create(notification);

  return { insertedCount: 1 };
};

const safeCreateBookmarkNotification = (payload) =>
  safeCreateNotifications(
    () => createBookmarkNotification(payload),
    {
      type: 'bookmark_added',
      userId: payload.userId,
      eventId: payload.eventId,
    }
  );

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
  buildBookmarkNotificationMessage,
  createEventNotifications,
  safeCreateEventNotifications,
  createBookmarkNotification,
  safeCreateBookmarkNotification,
  getUnreadNotificationCount,
};
