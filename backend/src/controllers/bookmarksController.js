const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const { safeCreateBookmarkNotification } = require('../services/notificationService');

const getBookmarkIds = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('bookmarks');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      bookmarkIds: user.bookmarks.map((id) => id.toString()),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookmarks', error: error.message });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('bookmarks');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const events = (user.bookmarks || []).filter(Boolean);

    return res.status(200).json({
      message: 'Bookmarks fetched successfully',
      events,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookmarks', error: error.message });
  }
};

const addBookmark = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findOne({ _id: eventId, isVerified: true });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadySaved = user.bookmarks.some((id) => id.toString() === eventId);
    if (alreadySaved) {
      return res.status(400).json({ message: 'Event already saved' });
    }

    user.bookmarks.push(eventId);
    await user.save();

    await safeCreateBookmarkNotification({
      userId: req.user._id,
      eventId: event._id,
      eventTitle: event.title,
    });

    return res.status(201).json({
      message: 'Event saved to bookmarks',
      bookmarkIds: user.bookmarks.map((id) => id.toString()),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save event', error: error.message });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.bookmarks.findIndex((id) => id.toString() === eventId);
    if (index === -1) {
      return res.status(404).json({ message: 'Event not in bookmarks' });
    }

    user.bookmarks.splice(index, 1);
    await user.save();

    return res.status(200).json({
      message: 'Event removed from bookmarks',
      bookmarkIds: user.bookmarks.map((id) => id.toString()),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove bookmark', error: error.message });
  }
};

module.exports = {
  getBookmarkIds,
  getBookmarks,
  addBookmark,
  removeBookmark,
};
