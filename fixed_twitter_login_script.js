// Auto-generated mobile automation script
// Device: Instance_3_8
// Base Resolution: 1080x2400
// Generated: 10/21/2025, 10:56:54 AM
// NOTE: Uses relative coordinates (%) for cross-device compatibility
// NOTE: Using human.* APIs for human-like behavior (anti-detect)

// Get current device screen size
const screenSize = await helpers.getScreenSize();
log(`Device resolution: ${screenSize.width}x${screenSize.height}`);

// Handle Cloudflare if present (FREE mode)
await cloudflare.handle();

// Step 1: Open Twitter/X app
await helpers.launchApp('com.twitter.android');
log('Opened app: X');
await helpers.sleep(2000); // Wait for app to load

// Step 2: Wait for app to fully load
await human.delay(4800, 5200);
log('Human-like delay ~5000ms');

// Step 3: Click on login/sign-in area (bottom area)
const tapX_3 = Math.round((68.61 / 100) * screenSize.width);
const tapY_3 = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX_3, tapY_3);
log('Human-like tap at 68.6%, 95.9%');

// Step 4: Wait for login screen
await human.delay(2800, 3200);
log('Human-like delay ~3000ms');

// Step 5: Click on "Use phone or email" or username field
const tapX_5 = Math.round((83.15 / 100) * screenSize.width);
const tapY_5 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_5, tapY_5);
log('Human-like tap at 83.2%, 95.4%');

// Step 6: Wait for input field
await human.delay(1800, 2200);
log('Human-like delay ~2000ms');

// Step 7: Type username/email
const fieldX_7 = Math.round((50.00 / 100) * screenSize.width);
const fieldY_7 = Math.round((40.00 / 100) * screenSize.height);
await human.tap(fieldX_7, fieldY_7);
await human.delay(300, 600);
await human.type(profile.metadata?.accounts?.x?.username || '');
log('Typed from account: username (human-like)');

// Step 8: Wait after typing username
await human.delay(1500, 2000);
log('Human-like delay ~1750ms');

// Step 9: Click "Next" button
const tapX_9 = Math.round((80.28 / 100) * screenSize.width);
const tapY_9 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_9, tapY_9);
log('Human-like tap at 80.3%, 95.4% (Next button)');

// Step 10: Wait for password screen
await human.delay(2800, 3200);
log('Human-like delay ~3000ms');

// Step 11: Type password
const fieldX_11 = Math.round((50.00 / 100) * screenSize.width);
const fieldY_11 = Math.round((34.00 / 100) * screenSize.height);
await human.tap(fieldX_11, fieldY_11);
await human.delay(300, 600);
await human.type(profile.metadata?.accounts?.x?.password || '');
log('Typed from account: password (human-like)');

// Step 12: Wait after typing password
await human.delay(1800, 2200);
log('Human-like delay ~2000ms');

// Step 13: Click "Log in" button
const tapX_13 = Math.round((80.28 / 100) * screenSize.width);
const tapY_13 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_13, tapY_13);
log('Human-like tap at 80.3%, 95.4% (Login button)');

// Step 14: Wait for login to complete
await human.delay(5000, 6000);
log('Waiting for login to complete...');

log('✅ Script completed successfully');
