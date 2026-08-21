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
 * Triggers the aggregation process with detailed per-source reporting
 * @param {string} actorUserId - The admin triggering this (if manual)
 */
const runAggregation = async (actorUserId = null) => {
  const errors = [];
  let devfolioEvents = [];
  let unstopEvents = [];
  
  // Detailed source statistics
  const sourceStats = {
    devfolio: {
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      inserted: 0,
      errors: []
    },
    unstop: {
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      inserted: 0,
      errors: []
    }
  };

  // Fetch Devfolio events
  try {
    console.log('[Aggregation] Fetching Devfolio events...');
    devfolioEvents = await fetchDevfolioEvents();
    sourceStats.devfolio.fetched = devfolioEvents.length;
    sourceStats.devfolio.normalized = devfolioEvents.length;
    console.log(`[Aggregation] Devfolio: ${devfolioEvents.length} events fetched`);
  } catch (e) {
    const errorMsg = `Devfolio: ${e.message}`;
    errors.push(errorMsg);
    sourceStats.devfolio.errors.push(errorMsg);
    console.error(`[Aggregation] ${errorMsg}`);
  }

  // Fetch Unstop events
  try {
    console.log('[Aggregation] Fetching Unstop events...');
    unstopEvents = await fetchUnstopEvents();
    sourceStats.unstop.fetched = unstopEvents.length;
    sourceStats.unstop.normalized = unstopEvents.length;
    console.log(`[Aggregation] Unstop: ${unstopEvents.length} events fetched`);
  } catch (e) {
    const errorMsg = `Unstop: ${e.message}`;
    errors.push(errorMsg);
    sourceStats.unstop.errors.push(errorMsg);
    console.error(`[Aggregation] ${errorMsg}`);
  }

  let allEvents = [...devfolioEvents, ...unstopEvents];
  
  if (allEvents.length === 0) {
    console.log('[Aggregation] No events fetched from any source');
    const status = errors.length === 0 ? 'success' : 'failed';
    
    const log = new SyncLog({
      status,
      devfolioCount: 0,
      unstopCount: 0,
      duplicatesSkipped: 0,
      errors,
    });

    await log.save();

    return {
      success: true,
      status,
      devfolioCount: 0,
      unstopCount: 0,
      duplicatesSkipped: 0,
      errors,
      sourceStats,
    };
  }
  
  console.log(`[Aggregation] Total events to process: ${allEvents.length}`);
  
  // Categorize
  allEvents = allEvents.map(categorizeEvent);

  // Deduplicate
  console.log('[Aggregation] Deduplicating events...');
  const { newEvents, duplicatesSkipped } = await deduplicateEvents(allEvents);
  
  // Calculate per-source duplicates
  const devfolioDuplicates = devfolioEvents.length - newEvents.filter(e => e.tags?.includes('devfolio')).length;
  const unstopDuplicates = unstopEvents.length - newEvents.filter(e => e.tags?.includes('unstop')).length;
  
  sourceStats.devfolio.duplicates = devfolioDuplicates;
  sourceStats.unstop.duplicates = unstopDuplicates;
  
  console.log(`[Aggregation] After deduplication: ${newEvents.length} new events, ${duplicatesSkipped} duplicates skipped`);

  const insertedEvents = [];

  // Insert new events
  console.log('[Aggregation] Inserting new events...');
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

      // Track per-source insertions
      if (newEvent.tags?.includes('devfolio')) {
        sourceStats.devfolio.inserted++;
      } else if (newEvent.tags?.includes('unstop')) {
        sourceStats.unstop.inserted++;
      }

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
      const errorMsg = `Failed to save event ${eventData.title}: ${err.message}`;
      errors.push(errorMsg);
      
      // Track error per source
      if (eventData.tags?.includes('devfolio')) {
        sourceStats.devfolio.errors.push(errorMsg);
      } else if (eventData.tags?.includes('unstop')) {
        sourceStats.unstop.errors.push(errorMsg);
      }
    }
  }

  const devfolioAdded = insertedEvents.filter(e => e.tags.includes('devfolio')).length;
  const unstopAdded = insertedEvents.filter(e => e.tags.includes('unstop')).length;

  console.log(`[Aggregation] Inserted ${insertedEvents.length} events (${devfolioAdded} Devfolio, ${unstopAdded} Unstop)`);
  console.log(`[Aggregation] Skipped ${duplicatesSkipped} duplicates`);

  const status = errors.length === 0 ? 'success' : insertedEvents.length > 0 ? 'partial' : 'failed';

  console.log('[Aggregation] Detailed Source Statistics:');
  console.log(`  Devfolio: Fetched=${sourceStats.devfolio.fetched}, Normalized=${sourceStats.devfolio.normalized}, Duplicates=${sourceStats.devfolio.duplicates}, Inserted=${sourceStats.devfolio.inserted}, Errors=${sourceStats.devfolio.errors.length}`);
  console.log(`  Unstop: Fetched=${sourceStats.unstop.fetched}, Normalized=${sourceStats.unstop.normalized}, Duplicates=${sourceStats.unstop.duplicates}, Inserted=${sourceStats.unstop.inserted}, Errors=${sourceStats.unstop.errors.length}`);

  const log = new SyncLog({
    status,
    devfolioCount: devfolioAdded,
    unstopCount: unstopAdded,
    duplicatesSkipped,
    errors,
    sourceStats,
  });

  await log.save();

  return {
    success: true,
    status,
    devfolioCount: devfolioAdded,
    unstopCount: unstopAdded,
    duplicatesSkipped,
    errors,
    sourceStats,
  };
};

module.exports = {
  runAggregation,
};
