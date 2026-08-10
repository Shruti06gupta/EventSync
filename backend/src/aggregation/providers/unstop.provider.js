const axios = require('axios');
const { cleanText } = require('../utils/textCleaner');

/**
 * Fetch events from Unstop
 * @returns {Promise<Array>} Array of parsed events
 */
const fetchUnstopEvents = async () => {
  console.log('Starting Unstop aggregation...');
  const events = [];
  const MAX_PAGES = 3;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=${page}&per_page=15`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 10000
      });

      console.log('Page fetched successfully');

      if (!response.data || !response.data.data || !response.data.data.data) {
        console.error('Unstop API response missing expected data structure.');
        break;
      }

      const items = response.data.data.data;
      console.log(`Number of cards found: ${items.length}`);

      if (items.length === 0) {
        break;
      }

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

      console.log(`Number of events extracted: ${extractedCount}`);

      if (page >= response.data.data.last_page) {
        break; // Reached the last page
      }
    }
  } catch (error) {
    console.error('Error fetching from Unstop:', error.message);
  }

  return events;
};

module.exports = {
  fetchUnstopEvents,
};
