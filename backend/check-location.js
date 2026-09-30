require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Event = require('./src/models/Event');
  
  const eventsWithLocation = await Event.countDocuments({ 
    isVerified: true, 
    location: { '$exists': true, '$ne': null } 
  });
  const totalEvents = await Event.countDocuments({ isVerified: true });
  
  console.log('Events with location field:', eventsWithLocation);
  console.log('Total verified events:', totalEvents);
  
  // Sample some venues to see what location data exists
  const sampleEvents = await Event.find({ isVerified: true })
    .limit(10)
    .select('title venue locationName location college')
    .lean();
  
  console.log('\nSample events with venue/location data:');
  sampleEvents.forEach(e => {
    console.log('Title:', e.title);
    console.log('Venue:', e.venue);
    console.log('LocationName:', e.locationName);
    console.log('Location:', e.location);
    console.log('College:', e.college);
    console.log('---');
  });
  
  await mongoose.disconnect();
}).catch(console.error);
