const axios = require('axios');

(async () => {
  try {
    let cookie = null;
    const random = Math.floor(Math.random() * 100000);
    const email = `chatbot${random}@test.com`;
    
    console.log(`Registering user... ${email}`);
    await axios.post('http://localhost:5000/auth/register', 
      { 
        name: 'chatbottest', 
        email, 
        password: 'Password123!', 
        confirmPassword: 'Password123!', 
        college: 'Test College' 
      }, 
      { validateStatus: () => true }
    );
    
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:5000/auth/login', 
      { email, password: 'Password123!' }, 
      { validateStatus: () => true }
    );
    
    if (loginRes.headers['set-cookie']) {
      cookie = loginRes.headers['set-cookie'][0];
    }
    
    if (!cookie) {
      console.error('Failed to get auth cookie.', loginRes.status);
      return;
    }
    
    const token = cookie.split(';')[0];
    console.log('Got cookie, sending chatbot request...');
    
    const chatRes = await axios.post('http://localhost:5000/chatbot', 
      { message: "Find hackathons", conversationContext: [] }, 
      { headers: { Cookie: token }, validateStatus: () => true }
    );
    
    console.log('Chatbot Response Status:', chatRes.status);
    console.log('Chatbot Response Data:', chatRes.data);
  } catch (err) {
    console.error('Script Error:', err.message);
  }
})();
