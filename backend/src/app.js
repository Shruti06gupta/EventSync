const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const aggregationRoutes = require('./routes/aggregation.routes');
const adminRoutes = require('./routes/adminRoutes');

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
      if (!origin || allowedOrigins.has(origin)) {
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

app.get('/health', (req, res) => {
  res.json({ message: 'EventSync API is running' });
});

module.exports = app;