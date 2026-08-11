require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const connectDB = require('../config/db');
const mongoose = require('mongoose');

if (process.env.EMAIL_DRY_RUN !== 'true') {
  console.warn(
    'Warning: testCron will use the real SMTP transporter unless EMAIL_DRY_RUN=true is set in backend/.env'
  );
}

const { processDeadlineReminders } = require('./deadlineCron');

const testCron = async () => {
  await connectDB();
  console.log('Testing processDeadlineReminders...');

  await processDeadlineReminders();

  console.log('Test complete. Closing connection.');
  mongoose.connection.close();
  process.exit(0);
};

testCron();
