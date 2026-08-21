require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { getSyncStatus } = require('../controllers/aggregation.controller');
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
    console.log('Testing sync status API directly...\n');
    
    // Mock request and response objects
    const req = {
      user: { _id: 'test-admin-id', role: 'admin' }
    };
    
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response Status: ${code}`);
          console.log('\n=== SYNC STATUS DATA ===\n');
          console.log(JSON.stringify(data, null, 2));
        }
      })
    };
    
    await getSyncStatus(req, res);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();