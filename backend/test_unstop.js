const axios = require('axios');

async function testUnstop() {
  try {
    const url = 'https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=1';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    if (response.data.data && response.data.data.data && response.data.data.data.length > 0) {
        console.log(JSON.stringify(response.data.data.data[0], null, 2));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}
testUnstop();
