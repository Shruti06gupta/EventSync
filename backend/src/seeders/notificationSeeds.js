const Notification = require('../models/Notification');
const User = require('../models/User');

const sampleMessages = [
  'New AI Hackathon added',
  'Registration deadline tomorrow',
  'New Web Development Workshop available',
];

const seedNotifications = async () => {
  const users = await User.find().select('_id').limit(5);

  if (users.length === 0) {
    return { insertedCount: 0, message: 'No users found to seed notifications for.' };
  }

  const notifications = users.flatMap((user, index) =>
    sampleMessages.map((message, messageIndex) => ({
      user: user._id,
      message,
      read: messageIndex === 2 && index % 2 === 0,
      createdAt: new Date(Date.now() - (index * 3 + messageIndex) * 60 * 60 * 1000),
      updatedAt: new Date(),
    }))
  );

  await Notification.deleteMany({
    user: { $in: users.map((user) => user._id) },
    message: { $in: sampleMessages },
  });

  const inserted = await Notification.insertMany(notifications);

  return { insertedCount: inserted.length };
};

module.exports = {
  seedNotifications,
  sampleMessages,
};
