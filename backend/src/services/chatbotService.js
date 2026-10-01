const { parseIntent } = require('../config/chatbotPrompts');
const { queryEvents, sortEventsByDeadline } = require('./eventQueryService');
const { isGeminiAvailable } = require('../utils/gemini');

const CHATBOT_EVENT_LIMIT = 10;

/**
 * Detect if a message is a follow-up/refinement
 * @param {string} userMessage - The user's message
 * @returns {boolean} True if this appears to be a follow-up
 */
const isFollowUp = (userMessage) => {
  const lowerMessage = userMessage.toLowerCase().trim();
  const followUpIndicators = [
    'what about', 'and', 'also', 'only', 'instead of',
    'show me more', 'more events', 'those', 'these', 'ones',
    'that', 'same', 'other ones', 'another'
  ];

  return followUpIndicators.some(indicator => lowerMessage.includes(indicator));
};

/**
 * Detect if a message uses "instead of" pattern to replace a specific filter
 * @param {string} userMessage - The user's message
 * @returns {object|null} { filter: string, value: string } or null
 */
const detectInsteadOfPattern = (userMessage) => {
  const lowerMessage = userMessage.toLowerCase().trim();
  const pattern = /instead of\s+([a-z\s]+?)(?:\s+(?:show|give|find|i want))?$/i;
  const match = lowerMessage.match(pattern);

  if (!match) return null;

  const oldValue = match[1].trim();
  // Try to detect what filter is being replaced
  if (['online', 'offline', 'hybrid'].includes(oldValue.toLowerCase())) {
    return { filter: 'mode', oldValue };
  }
  // Assume it's a location for now (simple heuristic)
  return { filter: 'location', oldValue };
};

/**
 * Merge follow-up intent with previous intent
 * @param {object} previousIntent - The previous successful intent
 * @param {object} newIntent - The new intent from parsing
 * @returns {object} Merged intent
 */
const mergeIntents = (previousIntent, newIntent) => {
  if (!previousIntent) return newIntent;
  if (!newIntent) return previousIntent; // Preserve previous if new is null (e.g., "show me more")

  return {
    intent: 'event_search',
    // Use new value if provided, otherwise preserve previous
    category: newIntent.category || previousIntent.category,
    location: newIntent.location || previousIntent.location,
    mode: newIntent.mode || previousIntent.mode,
    search: newIntent.search || previousIntent.search,
    startDate: newIntent.startDate || previousIntent.startDate,
    endDate: newIntent.endDate || previousIntent.endDate,
    needsClarification: newIntent.needsClarification,
  };
};

/**
 * Local parser for high-confidence deterministic queries
 * This avoids Gemini calls for obvious simple requests
 * @param {string} userMessage - The user's message
 * @param {Date} currentDate - Current date for relative date parsing
 * @returns {object|null} Parsed intent or null if not confidently parseable locally
 */
const parseLocalIntent = (userMessage, currentDate = new Date()) => {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Define valid categories and modes
  const validCategories = ['hackathon', 'art', 'design', 'gaming', 'marketing', 'programming', 'social impact', 'technology'];
  const validModes = ['online', 'offline', 'hybrid'];

  // Try to extract category
  let category = null;
  for (const cat of validCategories) {
    if (lowerMessage.includes(cat)) {
      category = cat.charAt(0).toUpperCase() + cat.slice(1);
      break;
    }
  }

  // Try to extract mode
  let mode = null;
  for (const m of validModes) {
    if (lowerMessage.includes(m)) {
      mode = m.charAt(0).toUpperCase() + m.slice(1);
      break;
    }
  }

  // Try to extract location (simple city names only - avoid over-matching)
  // Only extract if the message is very simple like "hackathons in delhi"
  const locationPatterns = /\b(in|at|from)\s+([a-z\s]+?)(?:\s+(?:from|on|this|next|between)|$)/i;
  const locationMatch = lowerMessage.match(locationPatterns);
  let location = null;
  if (locationMatch && locationMatch[2]) {
    const potentialLocation = locationMatch[2].trim();
    // Only accept simple single-word or well-known city names
    if (potentialLocation.split(' ').length <= 2 && potentialLocation.length >= 3) {
      location = potentialLocation.charAt(0).toUpperCase() + potentialLocation.slice(1);
    }
  }

  // If we didn't extract anything, let Gemini handle it
  if (!category && !mode && !location) {
    return null;
  }

  // Try to parse explicit date ranges (e.g., "from 1 to 25 October", "between 1 and 25 October")
  const dateRangePattern = /(?:from|between)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|and|-)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)/i;
  const dateMatch = lowerMessage.match(dateRangePattern);
  let startDate = null;
  let endDate = null;

  if (dateMatch) {
    const startDay = parseInt(dateMatch[1], 10);
    const endDay = parseInt(dateMatch[2], 10);
    const monthStr = dateMatch[3];

    const months = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3,
      'may': 4, 'june': 5, 'july': 6, 'august': 7,
      'september': 8, 'october': 9, 'november': 10, 'december': 11,
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const monthIndex = months[monthStr.toLowerCase()];
    if (monthIndex !== undefined) {
      const year = currentDate.getFullYear();
      startDate = new Date(year, monthIndex, startDay);
      endDate = new Date(year, monthIndex, endDay);

      // If the date is in the past, use next year
      if (endDate < currentDate) {
        startDate.setFullYear(year + 1);
        endDate.setFullYear(year + 1);
      }

      startDate = startDate.toISOString().split('T')[0];
      endDate = endDate.toISOString().split('T')[0];
    }
  }

  // Return structured intent
  return {
    intent: 'event_search',
    category,
    location,
    mode,
    search: null,
    startDate,
    endDate,
    needsClarification: false,
  };
};

/**
 * Process a chatbot message and return matching events
 * @param {string} userMessage - The user's natural language message
 * @param {object} conversationContext - Optional conversation context (for future use)
 * @returns {Promise<object>} Chatbot response with events
 */
const processChatMessage = async (userMessage, conversationContext = []) => {
  const startTime = Date.now();
  console.log('[ChatbotService] Processing message:', userMessage);

  if (!userMessage || typeof userMessage !== 'string') {
    return {
      success: false,
      error: 'Invalid message',
      message: 'Please provide a valid message.',
    };
  }

  // Get current date for relative date interpretation
  const currentDate = new Date();

  // Handle simple greetings locally (no Gemini call needed)
  const lowerMessage = userMessage.toLowerCase().trim();
  const simpleResponses = {
    'hi': "Hi! I can help you find events. Try asking something like 'Show me hackathons in Delhi' or 'online events this weekend'.",
    'hello': "Hello! I can help you find events. Try asking something like 'Show me hackathons in Delhi' or 'online events this weekend'.",
    'hey': "Hey! I can help you find events. Try asking something like 'Show me hackathons in Delhi' or 'online events this weekend'.",
    'help': "I can help you find events! You can search by:\n• Category (hackathons, design, gaming, etc.)\n• Location (Delhi, Mumbai, etc.)\n• Mode (online, offline, hybrid)\n• Date (this weekend, next month, etc.)\n\nExample: 'Show me hackathons in Delhi' or 'online events this weekend'",
  };

  if (simpleResponses[lowerMessage]) {
    const totalTime = Date.now() - startTime;
    console.log('[ChatbotService] Local response in', totalTime, 'ms');
    return {
      success: true,
      message: simpleResponses[lowerMessage],
      intent: { intent: 'greeting' },
      events: [],
      totalEvents: 0,
    };
  }

  // Try local parsing for high-confidence deterministic queries
  const localParseStart = Date.now();
  const localIntent = parseLocalIntent(userMessage, currentDate);
  const localParseTime = Date.now() - localParseStart;

  // Check if this is a follow-up and we have previous context
  const isFollowUpMessage = isFollowUp(userMessage);
  let previousIntent = null;

  if (isFollowUpMessage && Array.isArray(conversationContext) && conversationContext.length > 0) {
    // Find the last assistant message with a valid intent
    const lastAssistantMessage = [...conversationContext].reverse().find(msg => msg.role === 'assistant' && msg.intent && msg.intent.intent === 'event_search');
    if (lastAssistantMessage) {
      previousIntent = lastAssistantMessage.intent;
      console.log('[ChatbotService] Previous intent found for follow-up:', previousIntent);
    }
  }

  if (localIntent) {
    // If this is a follow-up, merge with previous intent
    const finalIntent = isFollowUpMessage && previousIntent ? mergeIntents(previousIntent, localIntent) : localIntent;

    console.log('[ChatbotService] Local intent parsed in', localParseTime, 'ms:', finalIntent);

    // Convert intent to query parameters
    const queryParams = convertIntentToQueryParams(finalIntent);

    // Query events
    const dbStart = Date.now();
    const queryResult = await queryEvents(queryParams, { limit: CHATBOT_EVENT_LIMIT, lean: true });
    const dbTime = Date.now() - dbStart;
    console.log('[ChatbotService] MongoDB query took:', dbTime, 'ms, found:', queryResult.totalEvents, 'events');

    if (!queryResult.success) {
      return {
        success: false,
        error: 'Failed to search events',
        message: 'I encountered an error while searching for events. Please try again.',
        intent: finalIntent,
        events: [],
      };
    }

    // Sort events by deadline
    const sortedEvents = sortEventsByDeadline(queryResult.events);

    // Generate response message
    const message = generateResponseMessage(finalIntent, sortedEvents.length, queryResult.totalEvents);

    const totalTime = Date.now() - startTime;
    console.log('[ChatbotService] Total time (local parse):', totalTime, 'ms');

    return {
      success: true,
      message,
      intent: finalIntent,
      events: sortedEvents,
      totalEvents: queryResult.totalEvents,
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

  // Parse intent using Gemini with conversation context
  const geminiStart = Date.now();
  const intent = await parseIntent(userMessage, currentDate, conversationContext);
  const geminiTime = Date.now() - geminiStart;
  console.log('[ChatbotService] Gemini intent parsing took:', geminiTime, 'ms');

  if (!intent) {
    return {
      success: false,
      error: 'Failed to understand your request',
      message: 'I couldn\'t understand your request. Please try rephrasing it.',
    };
  }

  // If this is a follow-up and Gemini didn't preserve context, merge manually
  const finalIntent = isFollowUpMessage && previousIntent ? mergeIntents(previousIntent, intent) : intent;
  if (isFollowUpMessage && previousIntent) {
    console.log('[ChatbotService] Merged follow-up intent:', finalIntent);
  }

  // Check if clarification is needed
  if (finalIntent.needsClarification) {
    const totalTime = Date.now() - startTime;
    console.log('[ChatbotService] Total time (clarification):', totalTime, 'ms');
    return {
      success: true,
      needsClarification: true,
      message: 'Could you provide more details about the location, date, or type of event you\'re looking for?',
      intent: finalIntent,
      events: [],
    };
  }

  // Convert intent to query parameters
  const queryParams = convertIntentToQueryParams(finalIntent);

  // Query events (use lean mode for chatbot to avoid unnecessary hydration)
  const dbStart = Date.now();
  const queryResult = await queryEvents(queryParams, { limit: CHATBOT_EVENT_LIMIT, lean: true });
  const dbTime = Date.now() - dbStart;
  console.log('[ChatbotService] MongoDB query took:', dbTime, 'ms, found:', queryResult.totalEvents, 'events');

  if (!queryResult.success) {
    return {
      success: false,
      error: 'Failed to search events',
      message: 'I encountered an error while searching for events. Please try again.',
      intent: finalIntent,
      events: [],
    };
  }

  // Sort events by deadline
  const sortedEvents = sortEventsByDeadline(queryResult.events);

  // Generate response message based on results
  const message = generateResponseMessage(finalIntent, sortedEvents.length, queryResult.totalEvents);

  const totalTime = Date.now() - startTime;
  console.log('[ChatbotService] Total time:', totalTime, 'ms');

  return {
    success: true,
    message,
    intent: finalIntent,
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
 * @param {number} displayedCount - Number of events being displayed
 * @param {number} totalCount - Total number of matching events
 * @returns {string} Response message
 */
const generateResponseMessage = (intent, displayedCount, totalCount) => {
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
  if (totalCount === 0) {
    const eventType = intent.category ? `${intent.category.toLowerCase()} events` : 'events';
    message = `I couldn't find any matching ${eventType} ${filterText}. You can try another location, category, or date range.`;
  } else if (totalCount === 1) {
    const eventType = intent.category ? intent.category.toLowerCase() : 'event';
    message = `I found 1 ${eventType} ${filterText}.`;
  } else {
    const eventType = intent.category ? `${intent.category.toLowerCase()} events` : 'events';
    // If we're showing fewer than total, mention it
    if (displayedCount < totalCount) {
      message = `I found ${totalCount} ${eventType} ${filterText}. Showing ${displayedCount} results.`;
    } else {
      message = `I found ${totalCount} ${eventType} ${filterText}.`;
    }
  }

  return message;
};

module.exports = {
  processChatMessage,
  convertIntentToQueryParams,
  generateResponseMessage,
  parseLocalIntent,
  isFollowUp,
  mergeIntents,
  detectInsteadOfPattern,
  CHATBOT_EVENT_LIMIT,
};
