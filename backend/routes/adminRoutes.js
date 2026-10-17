const express = require('express');
const {
  getDashboardStats,
  getAllOrders,
  getOrderDetail,
  updateOrderStatus,
  updatePaymentStatus,
  getInventory,
  updateStock,
  getStockAnalytics,
  getDailySalesData,
  getTopSellingItems,
  getReportData,
  verifyUpload,
  deleteUpload
} = require('../controllers/adminController');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} = require('../controllers/notificationController');
const { authMiddleware, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

// Dashboard
router.get('/stats', getDashboardStats);

// Orders
router.get('/orders', getAllOrders);
router.get('/orders/:orderId', getOrderDetail);
router.put('/orders/:orderId/status', updateOrderStatus);
router.put('/orders/:orderId/payment-status', updatePaymentStatus);

// Inventory/Stock
router.get('/inventory', getInventory);
router.get('/inventory/analytics', getStockAnalytics);
router.put('/inventory/:productId', updateStock);

// Reports
router.get('/reports/daily-sales', getDailySalesData);
router.get('/reports/top-items', getTopSellingItems);
router.get('/reports/data', getReportData);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:notificationId/read', markAsRead);
router.put('/notifications/mark-all-read', markAllAsRead);
router.get('/notifications/unread-count', getUnreadCount);
router.delete('/notifications/:notificationId', deleteNotification);

// Uploads
router.put('/upload/:id/verify', verifyUpload);
router.delete('/upload/:id', deleteUpload);

module.exports = router;
