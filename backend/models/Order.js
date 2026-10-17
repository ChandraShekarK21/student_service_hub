const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
    },
  ],
  totalPrice: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['Order placed', 'In queue', 'Packed successfully', 'Ready to collect', 'Ready to Collect', 'Delivered', 'Reviewed', 'Processing', 'Cancelled', 'Cancelled by User'],
    default: 'Order placed',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending',
  },
  remarks: { type: String, default: '' },
  statusHistory: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      changedBy: String,
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ studentId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
