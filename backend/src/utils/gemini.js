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
 * @param {string} modelName - The model name to use (default: 'gemini-3.5-flash')
 * @returns {object|null} The GenerativeModel instance or null if initialization failed
 */
const getGeminiModel = (modelName = 'gemini-3.5-flash') => {
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
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send a prompt to Gemini and get the response with timeout
 * @param {string} prompt - The prompt to send to Gemini
 * @param {object} options - Optional configuration
 * @param {string} options.modelName - The model name to use (default: 'gemini-3.5-flash')
 * @param {number} options.timeout - Timeout in milliseconds (default: 8000)
 * @returns {Promise<string|null>} The response text or null on error
 */
const generateContent = async (prompt, options = {}) => {
  const primaryModel = options.modelName || 'gemini-3.5-flash';
  const timeout = options.timeout || 8000; // 8 second timeout
  const fallbackModels = [
    primaryModel,
    'gemini-3.6-flash',
    // gemini-3.7-flash removed due to strict quota limits (20 requests/day free tier)
  ];

  for (let i = 0; i < fallbackModels.length; i++) {
    const modelName = fallbackModels[i];
    const model = getGeminiModel(modelName);
    if (!model) continue;

    try {
      const modelStart = Date.now();

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Race between Gemini request and timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise
      ]);

      const response = result.response;
      const modelTime = Date.now() - modelStart;
      console.log(`[Gemini] Model ${modelName} succeeded in ${modelTime}ms`);
      return response.text();
    } catch (error) {
      const is503 = error.message?.includes('503') || error.message?.includes('high demand');
      const isTimeout = error.message === 'Request timeout';

      if (is503 && i < fallbackModels.length - 1) {
        // 503 error: short delay before trying next model
        console.warn(`[Gemini] Model ${modelName} hit 503 (high demand), retrying next model in 500ms...`);
        await sleep(500);
        continue;
      }

      if (isTimeout && i < fallbackModels.length - 1) {
        // Timeout: try next model without delay
        console.error(`[Gemini] Model ${modelName} timed out after ${timeout}ms, trying next model...`);
        continue;
      }

      console.warn(`[Gemini] Model ${modelName} failed:`, error.message);
      // For other errors or last model, don't retry
      break;
    }
  }

  console.error('[Gemini] All model attempts failed.');
  return null;
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
