/**
 * Infers tags and categories based on event title and description
 * @param {Object} event 
 * @returns {Object} event with updated category and tags
 */
const categorizeEvent = (event) => {
  const text = `${event.title} ${event.description}`.toLowerCase();
  
  const keywords = {
    'hackathon': 'Hackathon',
    'coding': 'Programming',
    'developer': 'Technology',
    'design': 'Design',
    'ui/ux': 'Design',
    'business': 'Entrepreneurship',
    'startup': 'Entrepreneurship',
    'marketing': 'Marketing',
    'art': 'Art',
    'game': 'Gaming',
    'social': 'Social Impact',
  };

  let assignedCategory = event.category || 'Technology'; // default
  
  for (const [key, category] of Object.entries(keywords)) {
    if (text.includes(key)) {
      assignedCategory = category;
      if (!event.tags.includes(key)) {
        event.tags.push(key);
      }
    }
  }

  event.category = assignedCategory;
  return event;
};

module.exports = {
  categorizeEvent,
};
