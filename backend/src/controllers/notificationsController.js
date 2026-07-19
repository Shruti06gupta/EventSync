const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const { getUnreadNotificationCount } = require('../services/notificationService')

const getNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .lean(),
      getUnreadNotificationCount(req.user._id),
    ])

    return res.status(200).json({
      message: 'Notifications fetched successfully',
      notifications,
      unreadCount,
      total: notifications.length,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch notifications',
      error: error.message,
    })
  }
}

const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' })
    }

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    })

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    if (!notification.read) {
      notification.read = true
      await notification.save()
    }

    const unreadCount = await getUnreadNotificationCount(req.user._id)

    return res.status(200).json({
      message: 'Notification marked as read',
      notification,
      unreadCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update notification',
      error: error.message,
    })
  }
}

module.exports = {
  getNotifications,
  markNotificationAsRead,
}