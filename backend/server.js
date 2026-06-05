require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Expose io globally
global.io = io;

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`Socket client ${socket.id} joined room (user): ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/files', require('./routes/files'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/admin', require('./routes/admin'));

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected server error occurred',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
