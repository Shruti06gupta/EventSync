const User = require('../models/User');

const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  college: user.college,
  interests: user.interests,
  role: user.role,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null,
});

const getProfile = async (req, res) => {
  return res.status(200).json({
    user: formatUserResponse(req.user),
  });
};

const updateProfile = async (req, res) => {
  try {
    const { name, college, interests, profilePicture } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (college !== undefined) user.college = college;
    if (interests !== undefined && user.role !== 'admin') {
      user.interests = Array.isArray(interests) ? interests : user.interests;
    }
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};
const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ notificationPreferences: user.notificationPreferences || { email: true, deadlineReminders: true, newEvents: true, weeklyDigest: true } });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch preferences', error: error.message });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const { email, deadlineReminders, newEvents, weeklyDigest } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = { email: true, deadlineReminders: true, newEvents: true, weeklyDigest: true };
    }

    if (email !== undefined) user.notificationPreferences.email = email;
    if (deadlineReminders !== undefined) user.notificationPreferences.deadlineReminders = deadlineReminders;
    if (newEvents !== undefined) user.notificationPreferences.newEvents = newEvents;
    if (weeklyDigest !== undefined) user.notificationPreferences.weeklyDigest = weeklyDigest;

    await user.save();

    return res.status(200).json({
      message: 'Notification preferences updated successfully',
      notificationPreferences: user.notificationPreferences
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update preferences', error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
};