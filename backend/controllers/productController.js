const Product = require('../models/Product');
const Notification = require('../models/Notification');

const listProducts = async (req, res) => {
  const { search, category, sort, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (search) {
    const regex = { $regex: search.trim(), $options: 'i' };
    filter.$or = [{ name: regex }, { category: regex }];
  }
  if (category) {
    filter.category = { $regex: category.trim(), $options: 'i' };
  }

  const sortOptions = {};
  if (sort === 'price_asc') sortOptions.price = 1;
  if (sort === 'price_desc') sortOptions.price = -1;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sortOptions).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), limit: Number(limit) });
};

const getProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
};

const createProduct = async (req, res) => {
  const { name, category, price, stock, minStock, image } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ message: 'name, price and stock are required' });
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0 ||
      !Number.isInteger(Number(stock)) || Number(stock) < 0 ||
      (minStock != null && (!Number.isInteger(Number(minStock)) || Number(minStock) < 0))) {
    return res.status(400).json({ message: 'price, stock and minStock must be valid non-negative numbers' });
  }

  const product = await Product.create({ 
    name, 
    category, 
    price: Number(price),
    stock: Number(stock),
    minStock: minStock == null ? 10 : Number(minStock),
    image 
  });

  // Emit new product event
  if (global.io) {
    global.io.emit('product-created', {
      productId: product._id.toString(),
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
      image: product.image
    });
  }

  res.status(201).json(product);
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const oldProduct = await Product.findById(id);
  if (!oldProduct) return res.status(404).json({ message: 'Product not found' });

  for (const field of ['price', 'stock', 'minStock']) {
    if (updates[field] !== undefined &&
        (!Number.isFinite(Number(updates[field])) || Number(updates[field]) < 0 ||
          (field !== 'price' && !Number.isInteger(Number(updates[field]))))) {
      return res.status(400).json({ message: `${field} must be a valid non-negative ${field === 'price' ? 'number' : 'integer'}` });
    }
  }

  const product = await Product.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  const isLowStock = product.stock <= product.minStock;
  const wasLowStock = oldProduct.stock <= oldProduct.minStock;
  
  if (isLowStock && !wasLowStock) {
    try {
      await Notification.create({
        recipientId: null,
        recipientType: 'Admin',
        type: 'low_stock_alert',
        title: 'Low Stock Alert',
        message: `${product.name} is at or below its minimum stock level (${product.stock}/${product.minStock})`,
        productId: product._id
      });
    } catch (err) {
      console.error('Error creating low stock notification:', err);
    }
  }

  if (global.io) {
    const lowStockItems = await Product.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] } });
    global.io.emit('stock-updated', {
      productId: product._id.toString(),
      productName: product.name,
      newStock: product.stock,
      minStock: product.minStock,
      previousStock: oldProduct?.stock,
      isLowStock: isLowStock,
      category: product.category,
      price: product.price,
      badge: lowStockItems // Number of items below min stock
    });
    if (isLowStock && !wasLowStock) {
      global.io.to('admin-room').emit('low-stock-alert', {
        productId: product._id.toString(),
        productName: product.name,
        newStock: product.stock,
        minStock: product.minStock
      });
    }
  }
  
  res.json(product);
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Emit product deleted event
  if (global.io) {
    global.io.emit('product-deleted', {
      productId: product._id.toString(),
      productName: product.name
    });
  }

  res.json({ message: 'Product deleted', product });
};

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
