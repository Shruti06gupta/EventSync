/**
 * Test the geocoding utility
 */

const { geocodeLocation, shouldGeocode, isValidCoordinate, getCacheStats } = require('../utils/geocoder');

const testGeocoder = async () => {
  console.log('[Test] Testing geocoding utility...\n');

  // Test 1: Valid location
  console.log('[Test 1] Geocoding "Delhi, India"...');
  const delhi = await geocodeLocation('Delhi, India');
  console.log('Result:', delhi);
  console.log('Valid?', isValidCoordinate(delhi?.latitude, delhi?.longitude));
  console.log();

  // Test 2: Another valid location
  console.log('[Test 2] Geocoding "Mumbai"...');
  const mumbai = await geocodeLocation('Mumbai');
  console.log('Result:', mumbai);
  console.log('Valid?', isValidCoordinate(mumbai?.latitude, mumbai?.longitude));
  console.log();

  // Test 3: Invalid location
  console.log('[Test 3] Geocoding "InvalidLocationXYZ123"...');
  const invalid = await geocodeLocation('InvalidLocationXYZ123');
  console.log('Result:', invalid);
  console.log();

  // Test 4: shouldGeocode function
  console.log('[Test 4] Testing shouldGeocode...');
  console.log('shouldGeocode("Connaught Place, Delhi", "Offline"):', shouldGeocode('Connaught Place, Delhi', 'Offline'));
  console.log('shouldGeocode("Zoom", "Online"):', shouldGeocode('Zoom', 'Online'));
  console.log('shouldGeocode("Global", "Hybrid"):', shouldGeocode('Global', 'Hybrid'));
  console.log();

  // Test 5: Cache stats
  console.log('[Test 5] Cache stats:');
  console.log(getCacheStats());
  console.log();

  // Test 6: Cache hit (should be instant)
  console.log('[Test 6] Testing cache hit with "Delhi, India"...');
  const delhiCached = await geocodeLocation('Delhi, India');
  console.log('Result:', delhiCached);
  console.log('Same as first?', JSON.stringify(delhi) === JSON.stringify(delhiCached));
  console.log();

  console.log('[Test] All tests completed!');
};

testGeocoder();
