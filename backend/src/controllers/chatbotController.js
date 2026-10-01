const { processChatMessage } = require('../services/chatbotService');

const MAX_CONTEXT_MESSAGES = 5;

/**
 * Handle chatbot message from authenticated user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const handleChatMessage = async (req, res) => {
  try {
    const { message, conversationContext } = req.body;

    // Validate message
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      });
    }

    if (typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message must be a string.',
      });
    }

    if (message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
      });
    }

    // Limit message length to prevent abuse
    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long. Please keep it under 1000 characters.',
      });
    }

    // Validate and limit conversation context
    let limitedContext = [];
    if (Array.isArray(conversationContext)) {
      // Limit to last MAX_CONTEXT_MESSAGES
      limitedContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Process the message through chatbot service
    const result = await processChatMessage(message, limitedContext);

    // Return service result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      // Service failure (AI unavailable, parsing error, etc.)
      return res.status(500).json({
        success: false,
        message: result.message || 'Failed to process your request. Please try again.',
      });
    }
  } catch (error) {
    console.error('[ChatbotController] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.',
    });
  }
};

module.exports = {
  handleChatMessage,
};
