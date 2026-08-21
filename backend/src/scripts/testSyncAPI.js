require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
    // Create a test admin user with known credentials
    const testEmail = 'sync-test@example.com';
    const testPassword = 'TestPass123!';
    
    // Delete existing test user
    await User.deleteOne({ email: testEmail });
    
    // Create new test admin
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const testUser = await User.create({
      name: 'Sync Test Admin',
      email: testEmail,
      password: hashedPassword,
      college: 'Test College',
      role: 'admin',
    });
    
    console.log('Test admin user created:');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log(`User ID: ${testUser._id}`);
    
    // Now test the API directly
    const axios = require('axios');
    const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
    
    const api = axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      validateStatus: () => true,
    });
    
    const splitSetCookieHeader = (value) => {
      if (!value) return [];
      return value.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim()).filter(Boolean);
    };

    const getSetCookieHeaders = (headers) => {
      if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie();
      }
      return splitSetCookieHeader(headers.get('set-cookie'));
    };
    
    // Login
    console.log('\nAttempting login...');
    const loginRes = await api.post('/auth/login', { email: testEmail, password: testPassword });
    console.log(`Login status: ${loginRes.status}`);
    
    if (loginRes.status === 200) {
      const cookies = getSetCookieHeaders(loginRes.headers);
      const authenticatedClient = axios.create({
        baseURL: BASE_URL,
        headers: { Cookie: cookies.join('; ') },
        validateStatus: () => true,
      });
      
      // Test sync status endpoint
      console.log('\nTesting sync status endpoint...');
      const statusRes = await authenticatedClient.get('/aggregation/status');
      console.log(`Sync status status: ${statusRes.status}`);
      if (statusRes.status === 200) {
        console.log('Sync status data:', JSON.stringify(statusRes.data, null, 2));
      } else {
        console.log('Sync status failed:', statusRes.data);
      }
      
      // Test manual sync endpoint
      console.log('\nTesting manual sync endpoint...');
      const syncRes = await authenticatedClient.post('/aggregation/sync');
      console.log(`Manual sync status: ${syncRes.status}`);
      if (syncRes.status === 200) {
        console.log('Manual sync report:', JSON.stringify(syncRes.data.report, null, 2));
      } else {
        console.log('Manual sync failed:', syncRes.data);
      }
      
      // Test sync status again after sync
      console.log('\nTesting sync status after manual sync...');
      const statusAfterRes = await authenticatedClient.get('/aggregation/status');
      console.log('Sync status after sync:', JSON.stringify(statusAfterRes.data, null, 2));
      
    } else {
      console.log('✗ Login failed');
      console.log(loginRes.data);
    }
    
    // Cleanup
    await User.deleteOne({ email: testEmail });
    console.log('\nTest user cleaned up');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();