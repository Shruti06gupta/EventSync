const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (error) {
    console.error('[Gemini] Failed to initialize GoogleGenerativeAI:', error.message);
  }
}

/**
 * Get the Gemini model instance
 * @param {string} modelName - The model name to use (default: 'gemini-1.5-flash')
 * @returns {object|null} The GenerativeModel instance or null if initialization failed
 */
const getGeminiModel = (modelName = 'gemini-1.5-flash') => {
  if (!genAI) {
    console.warn('[Gemini] Gemini AI not initialized. Check GEMINI_API_KEY environment variable.');
    return null;
  }

  try {
    return genAI.getGenerativeModel({ model: modelName });
  } catch (error) {
    console.error('[Gemini] Failed to get model:', error.message);
    return null;
  }
};

/**
 * Send a prompt to Gemini and get the response
 * @param {string} prompt - The prompt to send to Gemini
 * @param {object} options - Optional configuration
 * @param {string} options.modelName - The model name to use (default: 'gemini-1.5-flash')
 * @returns {Promise<string|null>} The response text or null on error
 */
const generateContent = async (prompt, options = {}) => {
  const { modelName = 'gemini-1.5-flash' } = options;

  const model = getGeminiModel(modelName);
  if (!model) {
    return null;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini] API Error:', error.message);
    return null;
  }
};

/**
 * Check if Gemini is properly initialized
 * @returns {boolean} True if Gemini is initialized and ready to use
 */
const isGeminiAvailable = () => {
  return genAI !== null;
};

module.exports = {
  getGeminiModel,
  generateContent,
  isGeminiAvailable,
};
