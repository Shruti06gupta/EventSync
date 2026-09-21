const Event = require('../../models/Event');
const SyncLog = require('../../models/SyncLog');
const { fetchDevfolioEvents } = require('../providers/devfolio.provider');
const { fetchUnstopEvents } = require('../providers/unstop.provider');
const { deduplicateEvents } = require('./deduplication.service');
const { categorizeEvent } = require('./categorization.service');
const { safeCreateBatchEventNotifications } = require('../../services/notificationService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getEventImage } = require('../../utils/imageHelper');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

let isSyncRunning = false;

const isSyncActive = () => isSyncRunning;

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
  if (isSyncRunning) {
    console.log('[Aggregation] Sync already in progress, skipping concurrent trigger.');
    return {
      success: false,
      isAlreadyRunning: true,
      message: 'Synchronization is already running in the background.',
    };
  }

  isSyncRunning = true;
  const startTime = Date.now();

  const errors = [];
  let devfolioEvents = [];
  let unstopEvents = [];

  const sourceStats = {
    devfolio: {
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      inserted: 0,
      errors: [],
    },
    unstop: {
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      inserted: 0,
      errors: [],
    },
  };

  try {
    console.log('[Aggregation] Starting parallel fetching from providers...');

    const [devfolioRes, unstopRes] = await Promise.allSettled([
      fetchDevfolioEvents(),
      fetchUnstopEvents(),
    ]);

    if (devfolioRes.status === 'fulfilled') {
      devfolioEvents = devfolioRes.value || [];
      sourceStats.devfolio.fetched = devfolioEvents.length;
      sourceStats.devfolio.normalized = devfolioEvents.length;
      console.log(`[Aggregation] Devfolio: ${devfolioEvents.length} events fetched`);
    } else {
      const errorMsg = `Devfolio: ${devfolioRes.reason?.message || devfolioRes.reason}`;
      errors.push(errorMsg);
      sourceStats.devfolio.errors.push(errorMsg);
      console.error(`[Aggregation] ${errorMsg}`);
    }

    if (unstopRes.status === 'fulfilled') {
      unstopEvents = unstopRes.value || [];
      sourceStats.unstop.fetched = unstopEvents.length;
      sourceStats.unstop.normalized = unstopEvents.length;
      console.log(`[Aggregation] Unstop: ${unstopEvents.length} events fetched`);
    } else {
      const errorMsg = `Unstop: ${unstopRes.reason?.message || unstopRes.reason}`;
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
        sourceStats,
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
    console.log('[Aggregation] Deduplicating events against database...');
    const { newEvents, duplicatesSkipped } = await deduplicateEvents(allEvents);

    const devfolioDuplicates = devfolioEvents.length - newEvents.filter((e) => e.tags?.includes('devfolio')).length;
    const unstopDuplicates = unstopEvents.length - newEvents.filter((e) => e.tags?.includes('unstop')).length;

    sourceStats.devfolio.duplicates = Math.max(0, devfolioDuplicates);
    sourceStats.unstop.duplicates = Math.max(0, unstopDuplicates);

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

        eventData.image = getEventImage(
          eventData.image,
          eventData.title,
          eventData.organizer,
          eventData.category,
          eventData.source
        );

        // Sanitize location so GeoJSON index is never given invalid structure
        if (!eventData.location || !eventData.location.type || !Array.isArray(eventData.location.coordinates) || eventData.location.coordinates.length < 2) {
          delete eventData.location;
        }

        const newEvent = new Event(eventData);
        await newEvent.save();
        insertedEvents.push(newEvent);

        if (newEvent.tags?.includes('devfolio')) {
          sourceStats.devfolio.inserted++;
        } else if (newEvent.tags?.includes('unstop')) {
          sourceStats.unstop.inserted++;
        }
      } catch (err) {
        const errorMsg = `Failed to save event ${eventData.title}: ${err.message}`;
        errors.push(errorMsg);

        if (eventData.tags?.includes('devfolio')) {
          sourceStats.devfolio.errors.push(errorMsg);
        } else if (eventData.tags?.includes('unstop')) {
          sourceStats.unstop.errors.push(errorMsg);
        }
      }
    }

    // Trigger notifications for new events in a single optimized batch
    if (insertedEvents.length > 0) {
      console.log(`[Aggregation] Creating notifications for ${insertedEvents.length} new events...`);
      await safeCreateBatchEventNotifications(
        insertedEvents.map((e) => ({
          eventId: e._id,
          eventTitle: e.title,
          eventCategory: e.category,
          eventTags: e.tags,
          eventCollege: e.college,
          isPublic: e.isPublic,
        })),
        actorUserId || 'system'
      );
    }

    const devfolioAdded = insertedEvents.filter((e) => e.tags.includes('devfolio')).length;
    const unstopAdded = insertedEvents.filter((e) => e.tags.includes('unstop')).length;

    const status = errors.length === 0 ? 'success' : insertedEvents.length > 0 ? 'partial' : 'failed';
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[Aggregation] Completed in ${elapsedSeconds}s. Inserted ${insertedEvents.length} (${devfolioAdded} Devfolio, ${unstopAdded} Unstop), skipped ${duplicatesSkipped} duplicates.`);

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
      elapsedSeconds,
    };
  } finally {
    isSyncRunning = false;
  }
};

module.exports = {
  runAggregation,
  isSyncActive,
};
