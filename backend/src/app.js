const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('./config/logger');
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
      // In production, only allow explicitly configured origins
      if (process.env.NODE_ENV === 'production') {
        if (!origin || !allowedOrigins.has(origin)) {
          return callback(new Error(`CORS blocked for origin: ${origin}`));
        }
        return callback(null, true);
      }
      // In development, allow any localhost/127.0.0.1 origin
      if (!origin || allowedOrigins.has(origin) || origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for some frontend features
  })
);

// General rate limiting (all endpoints)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many requests from this IP, please try again later.' });
  },
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many authentication attempts, please try again later.' });
  },
});

// Rate limiting for password reset (very strict)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: { message: 'Too many password reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many password reset attempts, please try again later.' });
  },
});

app.use(express.json());
app.use(cookieParser());

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Apply stricter rate limiting to auth routes
app.use('/auth/register', authLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/forgot-password', passwordResetLimiter);
app.use('/auth/reset-password', passwordResetLimiter);

app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/api/events', eventRoutes);
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
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = { app, generalLimiter, authLimiter, passwordResetLimiter };
