require('dotenv').config({ path: './.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  const models = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-2.5-pro'
  ];

  const key = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(key);

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("hello");
      console.log(`${modelName}: SUCCESS`);
    } catch (e) {
      console.log(`${modelName}: FAILED - ${e.message.substring(0, 80)}`);
    }
  }
})();
