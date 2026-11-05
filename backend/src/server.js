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

let server;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal, exitProcess = true) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Force shutdown after 10 seconds timeout to avoid hanging processes
  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown: graceful shutdown timed out after 10 seconds');
    if (exitProcess) {
      process.exit(1);
    }
  }, 10000);

  // Unref timeout so it does not keep process open if everything finishes early
  if (forceExitTimer.unref) {
    forceExitTimer.unref();
  }

  const closeDatabase = async () => {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed successfully');
      }
    } catch (dbErr) {
      logger.error('Error closing MongoDB connection', { error: dbErr.message });
      throw dbErr;
    }
  };

  if (server && server.listening) {
    // Close idle keep-alive connections (Node 18+) so requests finish without hanging
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
        clearTimeout(forceExitTimer);
        if (exitProcess) process.exit(1);
        return;
      }

      logger.info('HTTP server closed to new requests');

      try {
        await closeDatabase();
        logger.info('Graceful shutdown completed cleanly');
        clearTimeout(forceExitTimer);
        if (exitProcess) process.exit(0);
      } catch (shutdownError) {
        logger.error('Error during database shutdown phase', { error: shutdownError.message });
        clearTimeout(forceExitTimer);
        if (exitProcess) process.exit(1);
      }
    });
  } else {
    // Server not running; close database directly
    try {
      await closeDatabase();
      logger.info('Graceful shutdown completed (server was not active)');
      clearTimeout(forceExitTimer);
      if (exitProcess) process.exit(0);
    } catch (shutdownError) {
      logger.error('Error during direct shutdown', { error: shutdownError.message });
      clearTimeout(forceExitTimer);
      if (exitProcess) process.exit(1);
    }
  }
};

// Register signal listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
      if (process.env.DISABLE_SCHEDULER === 'true') {
        logger.info('Schedulers disabled via DISABLE_SCHEDULER (no aggregation sync or deadline emails will run)');
      } else {
        initScheduler();
        initDeadlineCron();
      }

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