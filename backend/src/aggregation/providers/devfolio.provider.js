const axios = require('axios');
const { loadHtml } = require('../utils/htmlParser');
const { cleanText, resolveUrl } = require('../utils/textCleaner');

/**
 * Fetch events from Devfolio
 * Attempts to fetch real Devfolio hackathon data
 * @returns {Promise<Array>} Array of parsed events
 * @throws {Error} If fetching fails completely
 */
const fetchDevfolioEvents = async () => {
  console.log('[Devfolio] Starting event aggregation...');
  const events = [];

  try {
    // Devfolio uses a React SPA, but we can try multiple approaches:
    // 1. Direct HTML scraping for SSR content
    // 2. Try to find JSON data embedded in the HTML
    // 3. Use alternative public endpoints if available
    
    const url = 'https://devfolio.co/hackathons';
    console.log('[Devfolio] Fetching from hackathons page...');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000
    });

    // Try to extract embedded JSON data first (common in React SPAs)
    const scriptMatch = response.data.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    
    if (scriptMatch) {
      try {
        const jsonData = JSON.parse(scriptMatch[1]);
        console.log('[Devfolio] Found embedded Next.js data');
        
        // Try to extract hackathon data from the Next.js data structure
        // This is a best-effort approach as the structure may vary
        const props = jsonData?.props?.pageProps;
        
        if (props && Array.isArray(props.hackathons)) {
          console.log(`[Devfolio] Found ${props.hackathons.length} hackathons in embedded data`);
          
          for (const hackathon of props.hackathons) {
            try {
              const event = parseDevfolioEvent(hackathon);
              if (event) {
                events.push(event);
              }
            } catch (err) {
              console.warn(`[Devfolio] Failed to parse hackathon: ${err.message}`);
            }
          }
        }
      } catch (parseError) {
        console.warn('[Devfolio] Failed to parse embedded JSON data:', parseError.message);
      }
    }

    // If embedded data didn't work, try HTML scraping as fallback
    if (events.length === 0) {
      console.log('[Devfolio] No events from embedded data, trying HTML scraping...');
      
      const $ = loadHtml(response.data);
      
      // Try multiple potential selectors for Devfolio hackathon cards
      const selectors = [
        '[class*="HackathonCard"]',
        '[class*="hackathon-card"]',
        '[class*="EventCard"]',
        'a[href*="/hackathons/"]',
        '[data-testid*="hackathon"]'
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`[Devfolio] Found ${elements.length} elements with selector: ${selector}`);
          
          elements.each((i, el) => {
            try {
              const $el = $(el);
              const title = cleanText($el.find('h1, h2, h3, h4, [class*="title"], [class*="Title"]').first().text());
              const link = resolveUrl($el.attr('href') || $el.find('a').first().attr('href'), url);
              const organizer = cleanText($el.find('[class*="organizer"], [class*="Organizer"], [class*="company"]').first().text()) || 'Devfolio Host';
              const image = $el.find('img').first().attr('src') || '';
              
              // Try to extract dates from text
              const dateText = cleanText($el.find('[class*="date"], [class*="Date"], time').first().text());
              const venue = cleanText($el.find('[class*="location"], [class*="Location"], [class*="venue"]').first().text()) || 'Online';
              
              if (title && link && link.includes('hackathon')) {
                const parsedEvent = parseDevfolioEventFromHtml(title, link, organizer, image, dateText, venue);
                if (parsedEvent) {
                  events.push(parsedEvent);
                }
              }
            } catch (err) {
              console.warn(`[Devfolio] Failed to parse element: ${err.message}`);
            }
          });
          
          if (events.length > 0) {
            break; // Stop if we found events with this selector
          }
        }
      }
    }

    console.log(`[Devfolio] Total events fetched: ${events.length}`);

    if (events.length === 0) {
      throw new Error('No events could be fetched from Devfolio. The site structure may have changed or scraping is not possible.');
    }

  } catch (error) {
    console.error('[Devfolio] Error fetching events:', error.message);
    throw new Error(`Devfolio aggregation failed: ${error.message}`);
  }

  return events;
};

/**
 * Parse a Devfolio event object from embedded JSON data
 */
function parseDevfolioEvent(data) {
  if (!data) return null;

  const title = data.title || data.name;
  const link = data.slug ? `https://devfolio.co/hackathons/${data.slug}` : data.url;
  const organizer = data.organisation?.name || data.organizer || 'Devfolio Host';
  const image = data.banner?.url || data.image || data.thumbnail || '';
  
  if (!title || !link) {
    return null;
  }

  // Parse dates if available
  let startDate, endDate, registrationDeadline;
  
  if (data.startsAt) {
    startDate = new Date(data.startsAt);
  } else if (data.startDate) {
    startDate = new Date(data.startDate);
  } else {
    startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days from now
  }

  if (data.endsAt) {
    endDate = new Date(data.endsAt);
  } else if (data.endDate) {
    endDate = new Date(data.endDate);
  } else {
    endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Default to 2 days after start
  }

  if (data.registrationDeadline) {
    registrationDeadline = new Date(data.registrationDeadline);
  } else {
    registrationDeadline = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000); // Default to 1 day before start
  }

  // Validate date order
  if (registrationDeadline > startDate) {
    registrationDeadline = new Date(startDate.getTime());
  }
  if (endDate < startDate) {
    endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  }

  const venue = data.location?.city || data.venue || 'Online';
  const mode = venue.toLowerCase().includes('online') ? 'Online' : 
               venue.toLowerCase().includes('hybrid') ? 'Hybrid' : 'Offline';

  const description = data.description?.substring(0, 800) || 
                     `Participate in ${title}, a hackathon hosted by ${organizer}.`;

  return {
    title,
    description,
    organizer,
    college: 'Public',
    category: 'Hackathon',
    tags: ['hackathon', 'coding', 'devfolio'],
    source: 'devfolio',
    startDate,
    endDate,
    registrationDeadline,
    mode,
    venue,
    image: image || `https://picsum.photos/seed/${encodeURIComponent(title)}/800/400`,
    eventLink: link,
    isVerified: true,
    isAggregated: true,
    isPublic: true,
  };
}

/**
 * Parse a Devfolio event from HTML scraping
 */
function parseDevfolioEventFromHtml(title, link, organizer, image, dateText, venue) {
  // Try to parse dates from text
  let startDate, endDate, registrationDeadline;
  
  const now = new Date();
  
  if (dateText) {
    // Basic date parsing - this is a best-effort approach
    const dateMatch = dateText.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})/i);
    if (dateMatch) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames.findIndex(m => dateMatch[2].toLowerCase().startsWith(m.toLowerCase()));
      if (month !== -1) {
        startDate = new Date(parseInt(dateMatch[3]), month, parseInt(dateMatch[1]));
        endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
        registrationDeadline = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      }
    }
  }

  // Fallback to default dates if parsing failed
  if (!startDate) {
    startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    registrationDeadline = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);
  }

  const mode = venue.toLowerCase().includes('online') ? 'Online' : 
               venue.toLowerCase().includes('hybrid') ? 'Hybrid' : 'Offline';

  return {
    title,
    description: `Participate in ${title}, a hackathon hosted by ${organizer}. ${dateText ? `Scheduled for ${dateText}.` : ''}`,
    organizer,
    college: 'Public',
    category: 'Hackathon',
    tags: ['hackathon', 'coding', 'devfolio'],
    source: 'devfolio',
    startDate,
    endDate,
    registrationDeadline,
    mode,
    venue: venue || 'Online',
    image: image || `https://picsum.photos/seed/${encodeURIComponent(title)}/800/400`,
    eventLink: link,
    isVerified: true,
    isAggregated: true,
    isPublic: true,
  };
}

module.exports = {
  fetchDevfolioEvents,
};
