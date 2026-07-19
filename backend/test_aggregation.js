const mongoose = require('mongoose');
require('dotenv').config(); // if needed
const { runAggregation } = require('./src/aggregation/services/aggregation.service');

// Fake connect to DB so we can test the aggregation. Or we can just let it run if there's a local db.
// The user provided the EventSync project, assuming MongoDB is locally available or mockable.
async function test() {
  try {
    // If we need DB connection
    await mongoose.connect('mongodb://127.0.0.1:27017/eventsync', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log("Connected to DB");
    const result = await runAggregation();
    console.log("Aggregation Result:", result);
  } catch(e) {
    console.error("Test error:", e);
  } finally {
    await mongoose.disconnect();
  }
}
test();
