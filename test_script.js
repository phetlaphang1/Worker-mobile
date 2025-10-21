log('🚀 Test script starting...');
log('Profile: ' + profile.name);
log('Instance: ' + profile.instanceName);

// Launch Twitter app
await helpers.launchApp('com.twitter.android');
log('✅ Launched Twitter app');

// Wait 5 seconds
await helpers.sleep(5000);
log('✅ Waited 5 seconds');

log('✅ Script completed successfully!');
