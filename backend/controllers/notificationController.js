const Notification = require('../models/Notification');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Create notification
const createNotification = async (recipientId, recipientType, type, title, message, orderId = null, productId = null) => {
  try {
    const notification = new Notification({
      recipientId,
      recipientType,
      type,
      title,
      message,
      orderId,
      productId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

const getAdminNotificationQuery = (req) => ({
  recipientType: 'Admin',
  $or: [
    { recipientId: req.admin._id },
    { recipientId: null },
    { recipientId: { $exists: false } }
  ]
});

// Get notifications for authenticated admin
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find(getAdminNotificationQuery(req))
      .populate('orderId')
      .populate('productId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, ...getAdminNotificationQuery(req) },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification', error: error.message });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { ...getAdminNotificationQuery(req), read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ...getAdminNotificationQuery(req),
      read: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      ...getAdminNotificationQuery(req)
    });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
};
