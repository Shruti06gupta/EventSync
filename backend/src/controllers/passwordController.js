const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/email');

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes

    user.resetOTP = token;
    user.resetOTPExpiry = expiry;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${token}`;

    const subject = 'EventSync Password Reset';
    const text = `You requested a password reset. Click the link below to reset your password. It expires in 30 minutes.\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`;
    const html = `<p>You requested a password reset. Click the link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetLink}">Reset Password</a></p><p>If the link does not work, copy and paste this URL into your browser:</p><p>${resetLink}</p><p>If you did not request this, please ignore this email.</p>`;

    try {
      const emailResult = await sendEmail({ to: user.email, subject, text, html });

      if (emailResult?.preview) {
        return res.status(200).json({
          message: 'Password reset link generated, but email is not configured. Check the server console for the reset link.',
        });
      }
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr.message);
      return res.status(500).json({
        message: 'Failed to send reset email',
        error: mailErr.message,
      });
    }

    return res.status(200).json({ message: 'Password reset link sent to email' });
  } catch (error) {
    return res.status(500).json({ message: 'Forgot password failed', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and newPassword are required' });

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ resetOTP: token });
    if (!user || !user.resetOTP || !user.resetOTPExpiry) return res.status(400).json({ message: 'Invalid or expired reset token' });

    if (Date.now() > user.resetOTPExpiry.getTime()) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    user.password = newPassword; // will be hashed by pre-save hook
    user.resetOTP = null;
    user.resetOTPExpiry = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Reset password failed', error: error.message });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
};
