require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

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

const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  const cookies = getSetCookieHeaders(res.headers);
  return axios.create({
    baseURL: BASE_URL,
    headers: { Cookie: cookies.join('; ') },
    validateStatus: () => true,
  });
};

const run = async () => {
  try {
    console.log('Testing Dashboard API with existing admin user...\n');
    
    // Use existing admin user from database
    const adminEmail = 'vanigupta3036@gmail.com';
    const adminPassword = 'Passw0rd!'; // You may need to update this
    
    const adminClient = await login(adminEmail, adminPassword);
    
    const res = await adminClient.get('/admin/dashboard/stats');
    
    if (res.status === 200) {
      console.log('✓ Dashboard API accessed successfully\n');
      console.log('=== API RESPONSE ===\n');
      console.log(JSON.stringify(res.data, null, 2));
    } else {
      console.log(`✗ API returned status ${res.status}`);
      console.log(res.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
};

run();