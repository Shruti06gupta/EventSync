const axios = require('axios');
const { cleanText } = require('../utils/textCleaner');

const parseUnstopItem = (item) => {
  const title = item.title;
  const link = item.public_url ? `https://unstop.com/${item.public_url}` : null;
  if (!title || !link) return null;

  const organizer = item.organisation && item.organisation.name ? item.organisation.name : 'Unstop Host';
  const image = item.logoUrl2 || item.thumb || '';

  let descriptionText = '';
  if (item.details) {
    descriptionText = cleanText(item.details.replace(/<[^>]*>?/gm, ' '));
  } else if (item.seo_url) {
    descriptionText = cleanText(item.seo_url.replace(/-/g, ' '));
  }

  if (!descriptionText) {
    descriptionText = `Join ${title} on Unstop!`;
  }

  descriptionText = descriptionText.length > 800 ? descriptionText.substring(0, 797) + '...' : descriptionText;

  let regnDeadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  if (item.regnRequirements && item.regnRequirements.end_regn_dt) {
    regnDeadline = new Date(item.regnRequirements.end_regn_dt);
  }

  let startDate = item.start_date ? new Date(item.start_date) : new Date(regnDeadline.getTime() + 24 * 60 * 60 * 1000);
  let endDate = item.end_date ? new Date(item.end_date) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  if (startDate < regnDeadline) {
    startDate = new Date(regnDeadline.getTime());
  }
  if (endDate < startDate) {
    endDate = new Date(startDate.getTime());
  }

  const venue = item.region || 'Online';
  const mode = venue.toLowerCase().includes('online') ? 'Online' : 'Hybrid';

  return {
    title,
    description: descriptionText,
    organizer,
    college: 'Public',
    category: 'Hackathon',
    tags: ['unstop', 'competition'],
    source: 'unstop',
    startDate,
    endDate,
    registrationDeadline: regnDeadline,
    mode,
    venue,
    image: image || `https://picsum.photos/seed/${encodeURIComponent(title)}/800/400`,
    eventLink: link,
    isVerified: true,
    isAggregated: true,
    isPublic: true,
  };
};

/**
 * Fetch events from Unstop with concurrent batched pagination
 * @returns {Promise<Array>} Array of parsed events
 */
const fetchUnstopEvents = async () => {
  console.log('[Unstop] Starting event aggregation...');
  const events = [];
  const MAX_PAGES = 15;
  const PER_PAGE = 15;
  const BATCH_SIZE = 4;

  try {
    // Fetch first page to discover last_page
    const firstUrl = `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=${PER_PAGE}`;
    const firstRes = await axios.get(firstUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 15000
    });

    const firstItems = firstRes.data?.data?.data || [];
    const totalPages = Math.min(firstRes.data?.data?.last_page || MAX_PAGES, MAX_PAGES);

    for (const item of firstItems) {
      const parsed = parseUnstopItem(item);
      if (parsed) events.push(parsed);
    }
    console.log(`[Unstop] Page 1: ${events.length} events extracted (Total target pages: ${totalPages})`);

    // Fetch remaining pages in concurrent batches
    const remainingPages = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
      const batch = remainingPages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (page) => {
        try {
          const url = `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=${page}&per_page=${PER_PAGE}`;
          const res = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            },
            timeout: 12000
          });
          const items = res.data?.data?.data || [];
          return items.map(parseUnstopItem).filter(Boolean);
        } catch (err) {
          console.warn(`[Unstop] Failed page ${page}: ${err.message}`);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(pageEvents => {
        events.push(...pageEvents);
      });
    }

    console.log(`[Unstop] Total events fetched: ${events.length}`);
  } catch (error) {
    console.error('[Unstop] Error fetching events:', error.message);
    throw new Error(`Unstop aggregation failed: ${error.message}`);
  }

  return events;
};

module.exports = {
  fetchUnstopEvents,
};
