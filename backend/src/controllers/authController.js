const bcrypt = require('bcrypt');
const User = require('../models/User');
const { createAccessToken, createRefreshToken } = require('../utils/tokens');

const cookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
};

const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, college, interests, accountType, adminCode } = req.body;

    if (!name || !email || !password || !confirmPassword || !college) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    let role = 'student';

    if (accountType === 'admin') {
      if (!adminCode) {
        return res.status(400).json({ message: 'Admin code is required for admin registration' });
      }

      if (!process.env.ADMIN_CODE) {
        return res.status(503).json({ message: 'Admin registration is not configured' });
      }

      if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(403).json({ message: 'Invalid admin code' });
      }

      role = 'admin';
    } else if (accountType && accountType !== 'student') {
      return res.status(400).json({ message: 'Invalid account type' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      college,
      interests: Array.isArray(interests) ? interests : [],
      role,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        interests: user.interests,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(404).json({ message: 'Invalid email or password' });
    }

    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        interests: user.interests,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Logout failed', error: error.message });
  }
};

module.exports = {
  register,
  login,
  logout,
};