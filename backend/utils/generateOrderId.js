const Order = require('../models/Order');
const Counter = require('../models/Counter');

/**
 * Generates an atomic, yearly order number such as ORD2026001.
 */
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ORD${year}`;
  const counterId = `orderNumber:${year}`;

  const orderNumbers = await Order.find({
    orderNumber: { $regex: new RegExp(`^${prefix}(?!${year})\\d{3,}$`) }
  }).select('orderNumber').lean();

  const highestExistingSequence = orderNumbers.reduce((highest, order) => {
    const sequence = Number(order.orderNumber.slice(prefix.length));
    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);

  try {
    await Counter.findOneAndUpdate(
      { _id: counterId },
      { $setOnInsert: { sequence: highestExistingSequence } },
      { upsert: true, new: false }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { sequence: 1 } },
      { new: true }
    );
    const orderNumber = `${prefix}${String(counter.sequence).padStart(3, '0')}`;
    if (!await Order.exists({ orderNumber })) {
      return orderNumber;
    }
  }

  throw new Error(`Unable to generate a unique order number for ${year}`);
};

module.exports = generateOrderNumber;
