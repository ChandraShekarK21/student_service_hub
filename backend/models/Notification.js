const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Can be null for broadcast notifications
    refPath: 'recipientType'
  },
  recipientType: {
    type: String,
    enum: ['Student', 'Admin'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'order_placed',
      'order_in_queue',
      'order_reviewed',
      'order_processing',
      'order_packed_successfully',
      'order_ready_to_collect',
      'order_delivered',
      'order_cancelled',
      'order_cancelled_by_user',
      'order_status_updated',
      'low_stock_alert',
      'new_order_received',
      'stock_updated',
      'upload_created',
      'upload_downloaded',
      'upload_rated'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload' },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

// Index for faster queries
NotificationSchema.index({ recipientId: 1, recipientType: 1, createdAt: -1 });
NotificationSchema.index({ read: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Notification', NotificationSchema);
