const bcrypt = require('bcrypt');
const User = require('../models/User');
const sendEmail = require('../utils/email');

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otp, 10);

    user.resetOTP = hashedOTP;
    user.resetOTPExpiry = Date.now() + 2 * 60 * 1000; // 2 minutes
    await user.save();

    const subject = 'EventSync Password Reset OTP';
    const text = `Your OTP for password reset is: ${otp}. It expires in 2 minutes.`;

    try {
      const emailResult = await sendEmail({ to: user.email, subject, text });

      if (emailResult?.preview) {
        return res.status(200).json({
          message: 'OTP generated, but email is not configured. Check the server console for the OTP.',
        });
      }
    } catch (mailErr) {
      console.error('Failed to send OTP email:', mailErr.message);
      return res.status(500).json({
        message: 'Failed to send OTP email',
        error: mailErr.message,
      });
    }

    return res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    return res.status(500).json({ message: 'Forgot password failed', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP and newPassword are required' });

    const user = await User.findOne({ email });
    if (!user || !user.resetOTP || !user.resetOTPExpiry) return res.status(400).json({ message: 'Invalid or expired OTP' });

    if (Date.now() > user.resetOTPExpiry.getTime()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const isValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

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
