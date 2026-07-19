/**
 * Cleans up scraped text by trimming and replacing multiple spaces/newlines
 * @param {string} text 
 * @returns {string}
 */
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with single space
    .trim();
};

/**
 * Standardizes URLs
 * @param {string} url 
 * @param {string} baseUrl 
 * @returns {string}
 */
const resolveUrl = (url, baseUrl) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    return `${urlObj.protocol}//${urlObj.host}${url}`;
  }
  return url;
};

module.exports = {
  cleanText,
  resolveUrl,
};
