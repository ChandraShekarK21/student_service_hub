const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const generateOrderNumber = require('../utils/generateOrderId');
const { addNotification } = require('../utils/notificationHelper');

const placeOrder = async (req, res) => {
  const studentId = req.student._id;
  const { items: requestItems } = req.body;

  // Allow placing order either from cart or custom list
  const cart = await Cart.findOne({ studentId }).populate('products.productId');
  const itemsFromCart = cart ? cart.products : [];

  const items = requestItems && requestItems.length ? requestItems : itemsFromCart;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items to order' });
  }

  // Normalize items list
  const normalized = [];
  let total = 0;

  for (const entry of items) {
    const id = entry.productId || entry._id || entry.product?._id;
    if (!id) continue;

    const product = await Product.findById(id);
    if (!product) continue;

    const quantity = Number(entry.quantity || entry.qty || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Order quantities must be positive integers' });
    }
    if (quantity > product.stock) {
      return res.status(409).json({ message: `Not enough stock for ${product.name}` });
    }
    const price = product.price;

    normalized.push({ productId: product._id, name: product.name, quantity, price });
    total += price * quantity;
  }

  if (normalized.length === 0) {
    return res.status(400).json({ message: 'No valid products found' });
  }

  let order;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderNumber = await generateOrderNumber();
      try {
        order = await Order.create({
          orderNumber,
          studentId,
          items: normalized,
          totalPrice: total,
          status: 'Order placed',
        });
        break;
      } catch (error) {
        if (error.code !== 11000 || error.keyPattern?.orderNumber !== 1 || attempt === 4) throw error;
      }
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? 'Could not assign a unique order number. Please try again.' : 'Could not create order'
    });
  }

  const stockUpdates = [];
  for (const item of normalized) {
    const previousProduct = await Product.findById(item.productId);
    const updatedProduct = await Product.findByIdAndUpdate(
      { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity }, updatedAt: new Date() },
      { new: true }
    );
    if (!updatedProduct) {
      await Promise.all(stockUpdates.map(({ productId, quantity }) =>
        Product.findByIdAndUpdate(productId, { $inc: { stock: quantity } })
      ));
      await Order.findByIdAndDelete(order._id);
      return res.status(409).json({ message: `Stock changed while placing the order for ${item.name}; please try again` });
    }
    stockUpdates.push({
      productId: item.productId,
      quantity: item.quantity,
      previousProduct,
      updatedProduct
    });
  }

  for (const { previousProduct, updatedProduct } of stockUpdates) {
    if (updatedProduct && previousProduct &&
        previousProduct.stock > previousProduct.minStock &&
        updatedProduct.stock <= updatedProduct.minStock) {
      try {
        await Notification.create({
          recipientId: null,
          recipientType: 'Admin',
          type: 'low_stock_alert',
          title: 'Low Stock Alert',
          message: `${updatedProduct.name} is at or below its minimum stock level (${updatedProduct.stock}/${updatedProduct.minStock}) after order #${order.orderNumber}`,
          orderId: order._id,
          productId: updatedProduct._id
        });
      } catch (err) {
        console.error('Error creating low stock notification for order:', err);
      }
    }
  }

  try {
    const orderedItems = normalized.map(item => `${item.name} x ${item.quantity}`).join(', ');
    await Notification.create({
      recipientId: null,
      recipientType: 'Admin',
      type: 'new_order_received',
      title: 'New Order Received',
      message: `New order #${order.orderNumber} placed: ${orderedItems}`,
      orderId: order._id
    });
  } catch (err) {
    console.error('Error creating admin order notification:', err);
  }

  try {
    await Notification.create({
      recipientId: studentId,
      recipientType: 'Student',
      type: 'order_placed',
      title: 'Order Placed',
      message: `Your order #${order.orderNumber} was placed successfully.`,
      orderId: order._id
    });
  } catch (err) {
    console.error('Error creating student order notification:', err);
  }

  // Clear student cart
  await Cart.findOneAndUpdate({ studentId }, { products: [] });

  addNotification(studentId, `Order ${order.orderNumber} was placed successfully.`);

  // Emit real-time events
  if (global.io) {
    // Get all admins in admin-room and increment badge
    const unreadAdminOrders = await Notification.countDocuments({
      recipientType: 'Admin',
      read: false,
      type: 'new_order_received'
    });

    // Notify admin of new order with badge
    global.io.to('admin-room').emit('new-order', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      studentId: studentId.toString(),
      items: order.items,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
      badge: unreadAdminOrders // Unseen orders count
    });

    // Notify student dashboard of order update
    global.io.to(`student-${studentId}`).emit('order-placed', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      items: order.items,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt
    });

    // Emit stock update event for each product
    for (const item of normalized) {
      const updatedProduct = await Product.findById(item.productId);
      global.io.emit('stock-updated', {
        productId: item.productId.toString(),
        productName: item.name,
        newStock: updatedProduct.stock,
        minStock: updatedProduct.minStock,
        isLowStock: updatedProduct.stock <= updatedProduct.minStock
      });
    }
  }

  res.status(201).json(order);
};

const getStudentOrders = async (req, res) => {
  const studentId = req.student._id;
  const orders = await Order.find({ studentId, status: { $ne: 'Cancelled by User' } }).sort({ createdAt: -1 });
  res.json(orders);
};

const cancelStudentOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedStatuses = ['Order placed', 'In queue', 'Reviewed', 'Processing'];
    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        studentId: req.student._id,
        status: { $in: allowedStatuses }
      },
      {
        status: 'Cancelled by User',
        remarks: 'Cancelled by user',
        updatedAt: new Date(),
        $push: {
          statusHistory: {
            status: 'Cancelled by User',
            timestamp: new Date(),
            changedBy: String(req.student._id)
          }
        }
      },
      { new: true }
    );

    if (!order) {
      const existing = await Order.findOne({ _id: id, studentId: req.student._id }).select('status');
      if (!existing) return res.status(404).json({ message: 'Order not found' });
      return res.status(409).json({ message: `This order cannot be cancelled while its status is "${existing.status}"` });
    }

    const stockUpdates = await Promise.all(order.items.map(item =>
      Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity }, updatedAt: new Date() },
        { new: true }
      )
    ));

    if (global.io) {
      global.io.to('admin-room').emit('order-status-changed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        studentId: String(req.student._id)
      });
      for (const product of stockUpdates.filter(Boolean)) {
        global.io.emit('stock-updated', {
          productId: String(product._id),
          productName: product.name,
          newStock: product.stock,
          minStock: product.minStock,
          isLowStock: product.stock <= product.minStock
        });
      }
    }

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};

const getOrderById = async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  // Only allow student to fetch their own order
  if (String(order.studentId) !== String(req.student?._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.json(order);
};

const getAllOrders = async (req, res) => {
  const { rollNo, orderNumber, status, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (rollNo) {
    // req.query is rollNo, meaning student rollNo
    const student = await require('../models/Student').findOne({ rollNo: rollNo.trim() });
    if (student) filter.studentId = student._id;
  }
  if (orderNumber) {
    filter.orderNumber = { $regex: orderNumber, $options: 'i' };
  }
  if (status) {
    filter.status = status;
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, total, page: Number(page), limit: Number(limit) });
};

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  order.status = status;
  await order.save();

  addNotification(order.studentId, `Order ${order.orderNumber} status updated to '${status}'.`);

  try {
    await Notification.create({
      recipientId: order.studentId,
      recipientType: 'Student',
      type: 'order_status_updated',
      title: 'Order Status Updated',
      message: `Order #${order.orderNumber} is now ${status}`,
      orderId: order._id,
      read: false
    });
  } catch (err) {
    console.error('Error creating student notification:', err);
  }

  if (global.io) {
    // Get unread updates count for this student
    const unreadUpdates = await Notification.countDocuments({
      recipientId: order.studentId,
      recipientType: 'Student',
      read: false
    });

    // Emit order status update to student with badge
    global.io.to(`student-${order.studentId}`).emit('order-status-updated', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: status,
      badge: unreadUpdates
    });

    // Also notify admin of status change
    global.io.to('admin-room').emit('order-status-changed', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: status,
      studentId: order.studentId.toString()
    });
  }

  res.json(order);
};

module.exports = {
  placeOrder,
  getStudentOrders,
  getOrderById,
  cancelStudentOrder,
  getAllOrders,
  updateOrderStatus,
};
