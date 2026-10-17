const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

const getRecipientQuery = (req) => {
  if (req.student) {
    const query = { recipientId: req.student._id, recipientType: 'Student' };
    const uploadTypes = ['upload_created', 'upload_downloaded', 'upload_rated'];
    if (req.query.module === 'sharelearn') {
      query.type = { $in: uploadTypes };
    } else if (req.query.module === 'stationery') {
      query.type = { $nin: uploadTypes };
    }
    return query;
  }

  return {
    recipientType: 'Admin',
    $or: [
      { recipientId: req.admin._id },
      { recipientId: null },
      { recipientId: { $exists: false } }
    ]
  };
};

// Get all notifications for user (student or admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find(getRecipientQuery(req))
      .populate('orderId')
      .populate('productId')
      .populate('uploadId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Get unread count for user
router.get('/count/unread', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ ...getRecipientQuery(req), read: false });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
});

// Mark all notifications as read for user
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { ...getRecipientQuery(req), read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
});

// Delete all notifications for user
router.delete('/delete-all', authMiddleware, async (req, res) => {
  try {
    await Notification.deleteMany(getRecipientQuery(req));

    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notifications', error: error.message });
  }
});

router.put('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, ...getRecipientQuery(req) },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
});

// Delete single notification
router.delete('/:notificationId', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      ...getRecipientQuery(req)
    });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
});

module.exports = router;
