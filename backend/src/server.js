require('dotenv').config();

const { logger } = require('./config/logger');
const { app } = require('./app');
const connectDB = require('./config/db');
const { initScheduler } = require('./aggregation/services/scheduler.service');
const { initDeadlineCron } = require('./scripts/deadlineCron');

const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error('Error closing server', { error: err.message });
      process.exit(1);
    }

    logger.info('HTTP server closed');

    try {
      // Close MongoDB connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

let server;

const startServer = () => {
  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Stop the existing process or run the root dev script to auto-clean stale listeners.`);
    } else {
      logger.error('Server failed to start', { error: error.message });
    }

    process.exit(1);
  });

  connectDB().then(async (isDatabaseReady) => {
    if (isDatabaseReady) {
      initScheduler();
      initDeadlineCron();

      // Verify SMTP connection (non-blocking)
      const { verifySmtpConnection } = require('./utils/emailService');
      verifySmtpConnection().catch((error) => {
        logger.warn('SMTP verification failed (non-critical)', { error: error.message });
      });
      return;
    }

    logger.warn('Starting backend without a database connection. API routes that need MongoDB will fail until MONGO_URI is fixed.');
  }).catch((error) => {
    logger.error('Database startup check failed', { error: error.message });
  });
};

startServer();

// Export server for testing
module.exports = { server, gracefulShutdown };