const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const aggregationRoutes = require('./routes/aggregation.routes');
const adminRoutes = require('./routes/adminRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');

const app = express();

const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:56323',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow any localhost/127.0.0.1 origin in development
      if (!origin || allowedOrigins.has(origin) || origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/notifications', notificationRoutes);
app.use('/user', userRoutes);
app.use('/aggregation', aggregationRoutes);
app.use('/admin', adminRoutes);
app.use('/chatbot', chatbotRoutes);

app.get('/health', (req, res) => {
  res.json({ message: 'EventSync API is running' });
});

// Global error handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;