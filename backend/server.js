const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { authMiddleware, requireStudent, requireAdmin } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const profileRoutes = require('./routes/profileRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const Admin = require('./models/Admin');
const { seedProducts } = require('./utils/seedData');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/images', express.static('images'));

// Notifications are now handled by notificationRoutes
// See /api/notifications

// Serve static frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const seedAdmin = async () => {
  const username = process.env.ADMIN_USERNAME || 'stationery-admin';
  const password = process.env.ADMIN_PASSWORD || 'secureAdminPass123';

  const existing = await Admin.findOne({ username });
  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await Admin.create({ username, password: hashed });
    console.log(`✅ Admin seeded: ${username}`);
  }
};

const start = async () => {
  await connectDB();
  await seedAdmin();
  await seedProducts();

  // Create HTTP server and Socket.io
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Make io accessible globally
  global.io = io;

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Rooms: different students connect to their own room
    socket.on('join-student-room', (studentId) => {
      socket.join(`student-${studentId}`);
      console.log(`Student ${studentId} joined their room`);
    });

    // Admin connects to admin room
    socket.on('join-admin-room', () => {
      socket.join('admin-room');
      console.log(`Admin ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

start();


