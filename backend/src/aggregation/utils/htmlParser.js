const cheerio = require('cheerio');

/**
 * Extracts text from an HTML snippet or URL data using Cheerio
 * @param {string} html 
 * @returns {cheerio.Root}
 */
const loadHtml = (html) => {
  return cheerio.load(html);
};

module.exports = {
  loadHtml,
};
