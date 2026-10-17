const express = require('express');
const { placeOrder, getStudentOrders, getOrderById, cancelStudentOrder, getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { authMiddleware, requireStudent, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, requireStudent, placeOrder);
router.get('/', authMiddleware, requireStudent, getStudentOrders);
router.delete('/:id', authMiddleware, requireStudent, cancelStudentOrder);
router.get('/:id', authMiddleware, requireStudent, getOrderById);

// Admin routes
router.get('/admin/all', authMiddleware, requireAdmin, getAllOrders);
router.put('/admin/:id/status', authMiddleware, requireAdmin, updateOrderStatus);

module.exports = router;
