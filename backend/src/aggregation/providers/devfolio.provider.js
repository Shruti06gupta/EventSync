const axios = require('axios');
const { cleanText } = require('../utils/textCleaner');

/**
 * Fetch events from Devfolio via public API
 * @returns {Promise<Array>} Array of parsed events
 */
const fetchDevfolioEvents = async () => {
  console.log('[Devfolio] Starting event aggregation from API...');
  const events = [];
  let from = 0;
  const size = 100;
  const MAX_FETCH = 2000;
  let totalFetched = 0;
  
  try {
    const now = new Date();
    // Filter to exclude events that ended a long time ago
    const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    while (totalFetched < MAX_FETCH) {
      console.log(`[Devfolio] Fetching from offset ${from}...`);
      
      const response = await axios.post('https://api.devfolio.co/api/search/hackathons', 
        { from, size },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );

      const items = response.data?.hits?.hits;
      if (!items || items.length === 0) {
        console.log('[Devfolio] No more events found.');
        break;
      }
      
      console.log(`[Devfolio] Offset ${from}: ${items.length} events retrieved from API`);
      let extractedCount = 0;

      for (const item of items) {
        const source = item._source;
        if (!source) continue;

        let regnDeadline = source.hackathon_setting?.reg_ends_at ? new Date(source.hackathon_setting.reg_ends_at) : null;
        let startDate = source.starts_at ? new Date(source.starts_at) : null;
        let endDate = source.ends_at ? new Date(source.ends_at) : null;
        
        // Use startDate if regnDeadline is not available
        if (!regnDeadline && startDate) regnDeadline = new Date(startDate.getTime());
        
        // Skip events that are strictly in the past
        const checkDate = endDate || regnDeadline || startDate;
        if (checkDate && checkDate < cutoffDate) {
          continue; 
        }

        const title = source.name;
        const slug = source.slug;
        const link = slug ? `https://${slug}.devfolio.co` : null;
        const organizer = source.hosted_by || 'Devfolio Host';
        const image = source.hackathon_setting?.logo || source.cover_img || '';
        
        let descriptionText = cleanText(source.desc || source.tagline || '');
        if (!descriptionText) {
          descriptionText = `Join ${title} on Devfolio!`;
        }
        descriptionText = descriptionText.length > 800 ? descriptionText.substring(0, 797) + '...' : descriptionText;
        
        const venue = source.location || source.city || 'Online';
        let mode = 'Offline';
        if (source.apply_mode === 'online' || source.is_online || venue.toLowerCase().includes('online')) {
            mode = 'Online';
        } else if (source.apply_mode === 'both' || venue.toLowerCase().includes('hybrid')) {
            mode = 'Hybrid';
        }
        
        // Fallback for missing dates to prevent validation errors
        if (!startDate) startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (!endDate) endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        if (!regnDeadline) regnDeadline = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);
        
        // Enforce basic timeline constraints
        if (startDate < regnDeadline) startDate = new Date(regnDeadline.getTime());
        if (endDate < startDate) endDate = new Date(startDate.getTime());

        if (title && link) {
          events.push({
            title,
            description: descriptionText,
            organizer,
            college: 'Public',
            category: 'Hackathon',
            tags: ['devfolio', 'hackathon'],
            source: 'devfolio',
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
      
      console.log(`[Devfolio] Offset ${from}: ${extractedCount} upcoming/recent events extracted`);
      
      if (items.length < size) {
         break;
      }
      
      from += size;
      totalFetched += size;
    }
    
    console.log(`[Devfolio] Total active events fetched: ${events.length}`);
  } catch (error) {
    console.error('[Devfolio] Error fetching events:', error.message);
    throw new Error(`Devfolio aggregation failed: ${error.message}`);
  }
  
  return events;
};

module.exports = {
  fetchDevfolioEvents,
};