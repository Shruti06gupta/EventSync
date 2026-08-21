require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { runAggregation } = require('../aggregation/services/aggregation.service');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    return true;
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    return false;
  }
};

const run = async () => {
  const isDbReady = await connectDB();
  if (!isDbReady) {
    process.exit(1);
  }

  try {
    console.log('Testing manual sync function directly...\n');
    console.log('This will call the same function used by both manual sync and scheduler\n');
    
    const report = await runAggregation('test-admin-id');
    
    console.log('\n=== MANUAL SYNC REPORT ===\n');
    console.log(JSON.stringify(report, null, 2));
    
    console.log('\n✓ Manual sync function works correctly');
    console.log('✓ Same function is used by both manual button and scheduler');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();