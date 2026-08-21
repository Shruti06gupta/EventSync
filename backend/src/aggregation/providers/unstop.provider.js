const axios = require('axios');
const { cleanText } = require('../utils/textCleaner');

/**
 * Fetch events from Unstop with proper pagination
 * @returns {Promise<Array>} Array of parsed events
 */
const fetchUnstopEvents = async () => {
  console.log('[Unstop] Starting event aggregation...');
  const events = [];
  let page = 1;
  const MAX_PAGES = 20; // Safety limit to prevent infinite loops
  const PER_PAGE = 15;
  let consecutiveEmptyPages = 0;
  const MAX_EMPTY_PAGES = 2; // Stop after 2 consecutive empty pages

  try {
    while (page <= MAX_PAGES) {
      console.log(`[Unstop] Fetching page ${page}...`);
      
      const url = `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=${page}&per_page=${PER_PAGE}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 15000
      });

      if (!response.data || !response.data.data || !response.data.data.data) {
        console.error('[Unstop] API response missing expected data structure.');
        break;
      }

      const items = response.data.data.data;
      const lastPage = response.data.data.last_page || MAX_PAGES;
      
      console.log(`[Unstop] Page ${page}: ${items.length} events found (Last page: ${lastPage})`);

      if (items.length === 0) {
        consecutiveEmptyPages++;
        console.log(`[Unstop] Page ${page} returned no events (consecutive empty pages: ${consecutiveEmptyPages})`);
        
        if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
          console.log('[Unstop] Stopping due to consecutive empty pages');
          break;
        }
        page++;
        continue;
      }

      consecutiveEmptyPages = 0; // Reset counter on successful page
      let extractedCount = 0;

      for (const item of items) {
        const title = item.title;
        const link = item.public_url ? `https://unstop.com/${item.public_url}` : null;
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

        // Limit description length if very long to prevent database bloat
        descriptionText = descriptionText.length > 800 ? descriptionText.substring(0, 797) + '...' : descriptionText;

        let regnDeadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
        if (item.regnRequirements && item.regnRequirements.end_regn_dt) {
          regnDeadline = new Date(item.regnRequirements.end_regn_dt);
        }

        let startDate = item.start_date ? new Date(item.start_date) : new Date(regnDeadline.getTime() + 24 * 60 * 60 * 1000);

        let endDate = item.end_date ? new Date(item.end_date) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

        // Validate date order for schema (regnDeadline <= startDate <= endDate)
        if (startDate < regnDeadline) {
          startDate = new Date(regnDeadline.getTime());
        }
        if (endDate < startDate) {
          endDate = new Date(startDate.getTime());
        }

        const venue = item.region || 'Online';
        const mode = venue.toLowerCase().includes('online') ? 'Online' : 'Hybrid';

        if (title && link) {
          events.push({
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
          });
          extractedCount++;
        }
      }

      console.log(`[Unstop] Page ${page}: ${extractedCount} events extracted`);

      // Check if we've reached the last page
      if (page >= lastPage) {
        console.log(`[Unstop] Reached last page (${lastPage})`);
        break;
      }

      page++;
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
