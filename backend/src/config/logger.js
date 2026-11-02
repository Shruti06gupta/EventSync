const winston = require('winston');

// Define log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Development-friendly format
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? logFormat : devFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      // In production, only log errors and warnings to console
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Sanitize function to remove sensitive data from logs
const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password',
    'passwordConfirmation',
    'confirmPassword',
    'newPassword',
    'accessToken',
    'refreshToken',
    'jwt',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'cookie',
    'authorization',
    'authorizationHeader',
    'x-access-token',
  ];

  const sanitized = { ...obj };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
};

// Create a child logger that sanitizes sensitive data
const createSanitizedLogger = (meta = {}) => {
  return logger.child(sanitize(meta));
};

module.exports = {
  logger,
  createSanitizedLogger,
  sanitize,
};
