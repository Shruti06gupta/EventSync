require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const connectDB = require('../config/db');
const { processDeadlineReminders } = require('./deadlineCron');
const mongoose = require('mongoose');

const testCron = async () => {
  await connectDB();
  console.log('Testing processDeadlineReminders...');
  
  await processDeadlineReminders();
  
  console.log('Test complete. Closing connection.');
  mongoose.connection.close();
  process.exit(0);
};

testCron();
