require('dotenv').config({ path: 'C:/Users/Dell/Favorites/Documents/SHRUTI/OneDrive/Web development/EventSync/EventSync/backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.log('No API key found in .env');
      return;
    }
    const genAI = new GoogleGenerativeAI(key);
    console.log('Trying gemini-3.8-flash...');
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    const result = await model.generateContent("Say hello");
    console.log('Success:', result.response.text());
  } catch (err) {
    console.error('Error fetching gemini-3.8-flash:', err.message);
  }
})();
