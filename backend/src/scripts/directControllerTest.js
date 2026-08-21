require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { getDashboardStats } = require('../controllers/adminController');

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
    console.log('Testing adminController.getDashboardStats directly...\n');
    
    // Mock request and response objects
    const req = {
      user: { _id: 'test-admin-id', role: 'admin' }
    };
    
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response Status: ${code}`);
          console.log('\n=== DASHBOARD DATA ===\n');
          console.log('KPIs:', JSON.stringify(data.kpis, null, 2));
          console.log('\nUser Growth:', JSON.stringify(data.userGrowth, null, 2));
          console.log('\nEvent Creation Trend:', JSON.stringify(data.eventCreationTrend, null, 2));
          console.log('\nNotification Activity:', JSON.stringify(data.notificationActivity, null, 2));
          console.log('\nEngagement:', JSON.stringify(data.engagement, null, 2));
          console.log('\nEvent Overview:', JSON.stringify(data.eventOverview, null, 2));
          console.log('\nEvents by Platform:', JSON.stringify(data.eventsByPlatform, null, 2));
        }
      })
    };
    
    await getDashboardStats(req, res);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();