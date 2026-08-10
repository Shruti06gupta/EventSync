const Event = require('../../models/Event');

/**
 * Filters out events that already exist in the database based on title or eventLink
 * @param {Array} events 
 * @returns {Promise<{ newEvents: Array, duplicatesSkipped: number }>}
 */
const deduplicateEvents = async (events) => {
  if (!events || events.length === 0) return { newEvents: [], duplicatesSkipped: 0 };

  const newEvents = [];
  let duplicatesSkipped = 0;

  // We can fetch existing titles and links to compare in memory, 
  // or check one by one. For a large number, fetching existing is better.
  const titles = events.map(e => e.title);
  const links = events.map(e => e.eventLink).filter(Boolean);

  const existingEvents = await Event.find({
    $or: [
      { title: { $in: titles } },
      { eventLink: { $in: links } }
    ]
  }).select('title eventLink').lean();

  const existingTitles = new Set(existingEvents.map(e => e.title.toLowerCase()));
  const existingLinks = new Set(existingEvents.map(e => e.eventLink).filter(Boolean));

  for (const event of events) {
    if (
      existingTitles.has(event.title.toLowerCase()) || 
      (event.eventLink && existingLinks.has(event.eventLink))
    ) {
      duplicatesSkipped++;
    } else {
      newEvents.push(event);
      // Add to set to prevent duplicates within the same scraped batch
      existingTitles.add(event.title.toLowerCase());
      if (event.eventLink) existingLinks.add(event.eventLink);
    }
  }

  return { newEvents, duplicatesSkipped };
};

module.exports = {
  deduplicateEvents,
};
