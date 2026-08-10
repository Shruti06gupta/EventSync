const Event = require('../../models/Event');
const SyncLog = require('../../models/SyncLog');
const { fetchDevfolioEvents } = require('../providers/devfolio.provider');
const { fetchUnstopEvents } = require('../providers/unstop.provider');
const { deduplicateEvents } = require('./deduplication.service');
const { categorizeEvent } = require('./categorization.service');
const { safeCreateEventNotifications } = require('../../services/notificationService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getEventImage } = require('../../utils/imageHelper');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const generateSummary = async (description) => {
  if (!genAI || !description) return description;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize this event description in 2-3 short sentences. Keep it exciting: ${description}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return description;
  }
};

/**
 * Triggers the aggregation process
 * @param {string} actorUserId - The admin triggering this (if manual)
 */
const runAggregation = async (actorUserId = null) => {
  const errors = [];
  let devfolioEvents = [];
  let unstopEvents = [];

  try {
    devfolioEvents = await fetchDevfolioEvents();
  } catch (e) {
    errors.push(`Devfolio: ${e.message}`);
  }

  try {
    unstopEvents = await fetchUnstopEvents();
  } catch (e) {
    errors.push(`Unstop: ${e.message}`);
  }

  let allEvents = [...devfolioEvents, ...unstopEvents];
  
  // Categorize
  allEvents = allEvents.map(categorizeEvent);

  // Deduplicate
  const { newEvents, duplicatesSkipped } = await deduplicateEvents(allEvents);

  const insertedEvents = [];

  // Insert new events
  for (const eventData of newEvents) {
    try {
      if (genAI) {
        eventData.description = await generateSummary(eventData.description);
      }
      if (!eventData.source) {
        if (eventData.tags?.includes('devfolio')) {
          eventData.source = 'devfolio';
        } else if (eventData.tags?.includes('unstop')) {
          eventData.source = 'unstop';
        } else {
          eventData.source = 'manual';
        }
      }
      eventData.image = getEventImage(eventData.image, eventData.title, eventData.organizer, eventData.category, eventData.source);
      const newEvent = new Event(eventData);
      await newEvent.save();
      insertedEvents.push(newEvent);

      // Trigger notifications using existing system
      await safeCreateEventNotifications({
        actorUserId: actorUserId || 'system',
        eventId: newEvent._id,
        eventTitle: newEvent.title,
        eventCategory: newEvent.category,
        eventTags: newEvent.tags,
        eventCollege: newEvent.college,
        isPublic: newEvent.isPublic,
      });
    } catch (err) {
      errors.push(`Failed to save event ${eventData.title}: ${err.message}`);
    }
  }

  const devfolioAdded = insertedEvents.filter(e => e.tags.includes('devfolio')).length;
  const unstopAdded = insertedEvents.filter(e => e.tags.includes('unstop')).length;

  console.log(`Number of duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Number of new events inserted: ${insertedEvents.length}`);

  const status = errors.length === 0 ? 'success' : insertedEvents.length > 0 ? 'partial' : 'failed';

  const log = new SyncLog({
    status,
    devfolioCount: devfolioAdded,
    unstopCount: unstopAdded,
    duplicatesSkipped,
    errors,
  });

  await log.save();

  return {
    success: true,
    status,
    devfolioCount: devfolioAdded,
    unstopCount: unstopAdded,
    duplicatesSkipped,
    errors,
  };
};

module.exports = {
  runAggregation,
};
