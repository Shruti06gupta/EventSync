require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

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
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
};

startServer();