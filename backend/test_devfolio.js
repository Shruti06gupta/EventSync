const { fetchDevfolioEvents } = require('./src/aggregation/providers/devfolio.provider.js');

fetchDevfolioEvents().then(events => {
    console.log('Events length:', events.length);
    if (events.length > 0) {
        console.log('Sample Event Title:', events[0].title);
        console.log('Sample Event URL:', events[0].eventLink);
    }
}).catch(console.error);
