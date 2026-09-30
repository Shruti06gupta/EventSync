const { parseIntent } = require('../config/chatbotPrompts');
const { queryEvents, sortEventsByDeadline } = require('./eventQueryService');
const { isGeminiAvailable } = require('../utils/gemini');

const CHATBOT_EVENT_LIMIT = 10;

/**
 * Process a chatbot message and return matching events
 * @param {string} userMessage - The user's natural language message
 * @param {object} conversationContext - Optional conversation context (for future use)
 * @returns {Promise<object>} Chatbot response with events
 */
const processChatMessage = async (userMessage, conversationContext = {}) => {
  if (!userMessage || typeof userMessage !== 'string') {
    return {
      success: false,
      error: 'Invalid message',
      message: 'Please provide a valid message.',
    };
  }

  // Check if Gemini is available
  if (!isGeminiAvailable()) {
    return {
      success: false,
      error: 'AI service unavailable',
      message: 'The AI service is currently unavailable. Please try again later.',
    };
  }

  // Get current date for relative date interpretation
  const currentDate = new Date();

  // Parse intent using Gemini with conversation context
  const intent = await parseIntent(userMessage, currentDate, conversationContext);

  if (!intent) {
    return {
      success: false,
      error: 'Failed to understand your request',
      message: 'I couldn\'t understand your request. Please try rephrasing it.',
    };
  }

  // Check if clarification is needed
  if (intent.needsClarification) {
    return {
      success: true,
      needsClarification: true,
      message: 'Could you provide more details about the location, date, or type of event you\'re looking for?',
      intent,
      events: [],
    };
  }

  // Convert intent to query parameters
  const queryParams = convertIntentToQueryParams(intent);

  // Query events
  const queryResult = await queryEvents(queryParams, { limit: CHATBOT_EVENT_LIMIT });

  if (!queryResult.success) {
    return {
      success: false,
      error: 'Failed to search events',
      message: 'I encountered an error while searching for events. Please try again.',
      intent,
      events: [],
    };
  }

  // Sort events by deadline
  const sortedEvents = sortEventsByDeadline(queryResult.events);

  // Generate response message based on results
  const message = generateResponseMessage(intent, sortedEvents.length);

  return {
    success: true,
    message,
    intent,
    events: sortedEvents,
    totalEvents: queryResult.totalEvents,
  };
};

/**
 * Convert parsed intent to event query parameters
 * @param {object} intent - Parsed intent from Gemini
 * @returns {object} Query parameters for event search
 */
const convertIntentToQueryParams = (intent) => {
  const queryParams = {};

  if (intent.category) {
    queryParams.category = intent.category;
  }

  if (intent.location) {
    queryParams.locationName = intent.location;
  }

  if (intent.mode) {
    queryParams.mode = intent.mode;
  }

  if (intent.search) {
    queryParams.search = intent.search;
  }

  if (intent.startDate) {
    queryParams.startDate = intent.startDate;
  }

  if (intent.endDate) {
    queryParams.endDate = intent.endDate;
  }

  return queryParams;
};

/**
 * Generate a conversational response message based on intent and result count
 * @param {object} intent - Parsed intent
 * @param {number} eventCount - Number of events found
 * @returns {string} Response message
 */
const generateResponseMessage = (intent, eventCount) => {
  const filters = [];

  if (intent.location) {
    filters.push(`in ${intent.location}`);
  }

  if (intent.mode) {
    filters.push(intent.mode.toLowerCase());
  }

  const filterText = filters.length > 0 ? filters.join(' ') : 'upcoming';
  
  // Build the response message
  let message;
  if (eventCount === 0) {
    const eventType = intent.category ? `${intent.category.toLowerCase()} events` : 'events';
    message = `I couldn't find any matching ${eventType} ${filterText}. You can try another location, category, or date range.`;
  } else if (eventCount === 1) {
    const eventType = intent.category ? intent.category.toLowerCase() : 'event';
    message = `I found 1 ${eventType} ${filterText}.`;
  } else {
    const eventType = intent.category ? `${intent.category.toLowerCase()} events` : 'events';
    message = `I found ${eventCount} ${eventType} ${filterText}.`;
  }

  return message;
};

module.exports = {
  processChatMessage,
  convertIntentToQueryParams,
  generateResponseMessage,
  CHATBOT_EVENT_LIMIT,
};
