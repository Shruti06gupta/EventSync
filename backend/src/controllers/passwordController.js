const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const sendEmail = require('../utils/email');

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes

      // Hash the token before storing
      const tokenHash = await bcrypt.hash(token, 10);
      
      user.resetOTP = tokenHash;
      user.resetOTPExpiry = new Date(expiry);
      await user.save();

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const resetLink = `${clientUrl}/reset-password?token=${token}`;

      const subject = 'Reset your EventSync password';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #2563eb; text-align: center;">EventSync</h2>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #1f2937; margin-top: 0;">Reset Your Password</h3>
            <p style="font-size: 16px;">Hi ${user.name || 'there'},</p>
            <p style="font-size: 16px;">We received a request to reset your EventSync password.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">This link expires in 30 minutes.</p>
            <p style="font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="font-size: 14px; word-break: break-all; color: #2563eb;">${resetLink}</p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
        </div>
      `;
      const text = `Hi ${user.name || 'there'},\n\nWe received a request to reset your EventSync password. Click the link below to reset your password:\n\n${resetLink}\n\nThis link expires in 30 minutes.\n\nIf you didn't request this, you can safely ignore this email.`;

      try {
        const emailResult = await sendEmail({ to: user.email, subject, text, html });

        if (emailResult?.preview) {
          console.error('[Password Reset] Email service in preview mode - SMTP not properly configured');
          return res.status(500).json({ 
            message: 'Email service is not configured. Please contact support.' 
          });
        }
        
        if (emailResult?.status !== 'sent') {
          console.error('[Password Reset] Email delivery failed:', emailResult);
          return res.status(500).json({ 
            message: 'Failed to send reset email. Please try again later.' 
          });
        }
      } catch (mailErr) {
        console.error('[Password Reset] Email send error:', mailErr.message);
        return res.status(500).json({ 
          message: 'Failed to send reset email. Please try again later.' 
        });
      }
    }

    return res.status(200).json({ 
      message: 'If an account exists for that email, password reset instructions have been sent.' 
    });
  } catch (error) {
    console.error('[Password Reset] Server error:', error.message);
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

    // Find user by comparing hashed tokens
    const users = await User.find({ resetOTP: { $ne: null } });
    let user = null;
    
    for (const u of users) {
      if (!u.resetOTP || !u.resetOTPExpiry) continue;
      const isValid = await bcrypt.compare(token, u.resetOTP);
      if (isValid) {
        user = u;
        break;
      }
    }

    if (!user || !user.resetOTP || !user.resetOTPExpiry) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

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
