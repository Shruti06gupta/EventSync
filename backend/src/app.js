const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger, sanitize } = require('./config/logger');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const aggregationRoutes = require('./routes/aggregation.routes');
const adminRoutes = require('./routes/adminRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');

const app = express();

// Trust proxy for secure reverse proxy deployments (e.g. Render, Railway, Vercel, Nginx, AWS)
app.set('trust proxy', 1);

// Parse allowed client origins (support comma-separated origins in CLIENT_URL)
const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]);

app.use(
  cors({
    origin(origin, callback) {
      // In production, only allow explicitly configured origins
      if (process.env.NODE_ENV === 'production') {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      }
      // In development, allow localhost/127.0.0.1 origins
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        origin?.startsWith('http://localhost:') ||
        origin?.startsWith('http://127.0.0.1:')
      ) {
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
        connectSrc: [
          "'self'",
          "https:",
          ...(process.env.NODE_ENV !== 'production' ? ["ws:", "http:"] : []),
        ],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// General rate limiting (all endpoints)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many requests from this IP, please try again later.' });
  },
});

// Authentication rate limiting (protects login and register against brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts per 15 minutes in prod, elevated in test
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many authentication attempts, please try again later.' });
  },
});

// Rate limiting for password reset (strict protection against reset token enumeration/spam)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: { message: 'Too many password reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many password reset attempts, please try again later.' });
  },
});

// Rate limiting for chatbot endpoint (protects Gemini AI quota)
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 queries per 15 minutes
  message: { message: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Chatbot rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many AI requests, please try again later.' });
  },
});

// Rate limiting for manual aggregation sync (protects external scraping targets)
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many aggregation requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Aggregation rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ message: 'Too many aggregation requests, please try again later.' });
  },
});

app.use(express.json());
app.use(cookieParser());

// Request logging middleware (redacts sensitive parameters)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Skip health checks to keep logs clean
    if (req.path === '/health') return;

    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    };

    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
      logData.body = sanitize(req.body);
    }

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${logData.path} ${res.statusCode} (${duration}ms)`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${logData.path} ${res.statusCode} (${duration}ms)`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${logData.path} ${res.statusCode} (${duration}ms)`, logData);
    }
  });
  next();
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Apply endpoint-specific rate limiting
app.use('/auth/register', authLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/forgot-password', passwordResetLimiter);
app.use('/auth/reset-password', passwordResetLimiter);
app.use('/chatbot', chatbotLimiter);
app.use('/aggregation/sync', syncLimiter);

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

module.exports = {
  app,
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  chatbotLimiter,
  syncLimiter,
};
