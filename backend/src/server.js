require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { initScheduler } = require('./aggregation/services/scheduler.service');
const { initDeadlineCron } = require('./scripts/deadlineCron');

const PORT = process.env.PORT || 5000;

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing process or run the root dev script to auto-clean stale listeners.`);
    } else {
      console.error('Server failed to start:', error.message);
    }

    process.exit(1);
  });

  connectDB().then((isDatabaseReady) => {
    if (isDatabaseReady) {
      initScheduler();
      initDeadlineCron();
      return;
    }

    console.warn('Starting backend without a database connection. API routes that need MongoDB will fail until MONGO_URI is fixed.');
  }).catch((error) => {
    console.error('Database startup check failed:', error.message);
  });
};

startServer();