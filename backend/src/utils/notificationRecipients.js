const { normalizeRecipient } = require('./emailService');

const hasDeadlineRemindersEnabled = (user) =>
  user?.notificationPreferences?.deadlineReminders !== false;

const hasEmailNotificationsEnabled = (user) =>
  user?.notificationPreferences?.email !== false;

const getValidatedUserEmail = (user) => {
  if (!user?.email) {
    return { email: null, valid: false, reason: 'missing email on user record' };
  }

  const email = normalizeRecipient(user.email);
  if (!email) {
    return { email: user.email, valid: false, reason: 'invalid email format' };
  }

  return { email, valid: true };
};

const isEligibleForDeadlineReminders = (user) => {
  if (!hasDeadlineRemindersEnabled(user)) {
    return false;
  }

  return getValidatedUserEmail(user).valid;
};

module.exports = {
  getValidatedUserEmail,
  hasDeadlineRemindersEnabled,
  hasEmailNotificationsEnabled,
  isEligibleForDeadlineReminders,
};
