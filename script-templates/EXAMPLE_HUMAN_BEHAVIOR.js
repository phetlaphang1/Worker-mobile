/**
 * EXAMPLE: Human-like Behavior Script
 * Demonstrates how to use the `human` object for realistic automation
 *
 * Available in all scripts:
 * - helpers: Basic ADB commands (tap, type, swipe, etc.)
 * - human: Human-like behaviors with delays and randomness
 * - log: Console logging
 * - profile: Profile information
 */

// ========================================
// EXAMPLE 1: Twitter Login with Human Behavior
// ========================================

async function humanTwitterLogin() {
  log('🤖 Starting human-like Twitter login...');

  // Launch Twitter app
  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Wait for login button to appear
  await helpers.waitForText('Log in', { timeout: 10000 });

  // Human thinking before clicking login
  await human.think(); // Random delay 800-2000ms

  // Human-like tap on "Log in" button
  await human.tap(180, 500); // With random offset and delays

  // Wait for username field
  await helpers.sleep(2000);

  // Get account credentials from profile
  const account = helpers.getAccount('twitter');
  if (!account) {
    log('❌ No Twitter account found in profile');
    return;
  }

  log(`📝 Logging in as: ${account.username}`);

  // Tap on username field with human behavior
  await human.tap(180, 300);
  await helpers.sleep(500);

  // Human-like typing (variable speed, random pauses)
  await human.type(account.username);

  // Thinking delay before tapping Next
  await human.think();

  // Tap Next button
  await human.tap(180, 600);
  await helpers.sleep(2000);

  // Tap on password field
  await human.tap(180, 300);
  await helpers.sleep(500);

  // Type password with human behavior
  await human.type(account.password);

  // Final thinking before login
  await human.think();

  // Tap Login button
  await human.tap(180, 600);

  log('✅ Login completed with human-like behavior!');
}

// ========================================
// EXAMPLE 2: Reading Timeline (Realistic Scrolling)
// ========================================

async function humanReadTimeline() {
  log('📱 Reading timeline with human behavior...');

  // Launch Twitter
  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Read 10 tweets
  for (let i = 0; i < 10; i++) {
    log(`Reading tweet ${i + 1}/10...`);

    // Human reading time (based on average tweet length ~100 chars)
    await human.read(100); // ~2-3 seconds

    // Random chance to pause (distracted)
    if (Math.random() < 0.2) { // 20% chance
      log('💭 Getting distracted...');
      await human.delay(1000, 3000);
    }

    // Human-like scroll with curve
    await human.scroll(300, { centerX: 180, startY: 400 });

    // Random chance to scroll back up (re-read)
    if (Math.random() < 0.1) { // 10% chance
      log('👆 Scrolling back up...');
      await human.scroll(-150);
      await human.read(50);
    }
  }

  log('✅ Finished reading timeline naturally!');
}

// ========================================
// EXAMPLE 3: Liking Tweets (Random Behavior)
// ========================================

async function humanLikeTweets() {
  log('❤️ Liking tweets with human behavior...');

  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  for (let i = 0; i < 5; i++) {
    log(`Processing tweet ${i + 1}/5...`);

    // Read the tweet first
    await human.read(120);

    // 70% chance to like
    if (Math.random() < 0.7) {
      log('❤️ Liking this tweet...');

      // Thinking before liking
      await human.think();

      // Find and tap like button (usually on the right side)
      await human.tap(280, 500);

      // Post-like delay
      await human.delay(500, 1500);
    } else {
      log('⏭️ Skipping this tweet...');
    }

    // Scroll to next tweet
    await human.scroll(400);
  }

  log('✅ Finished liking tweets naturally!');
}

// ========================================
// EXAMPLE 4: Posting a Tweet (Careful Typing)
// ========================================

async function humanPostTweet(tweetText) {
  log('✍️ Posting tweet with human behavior...');

  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Tap compose button (FAB)
  await human.think();
  await human.tap(300, 550); // Bottom right FAB
  await helpers.sleep(1500);

  // Tap text area
  await human.tap(180, 200);
  await helpers.sleep(500);

  // Human-like typing with pauses
  log(`Typing: "${tweetText}"`);
  await human.type(tweetText, {
    charDelay: [100, 250], // Slower typing
    pauseChance: 0.05      // 5% chance to pause per char
  });

  // Read what was typed (proof-reading)
  await human.read(tweetText.length);

  // Thinking before posting
  await human.think();

  // Tap Post button
  await human.tap(310, 50); // Top right

  log('✅ Tweet posted with human behavior!');
}

// ========================================
// EXAMPLE 5: Comparing human vs helpers
// ========================================

async function compareHumanVsBasic() {
  log('🔬 Comparing basic helpers vs human behavior...');

  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // BASIC (Robotic - DETECTABLE)
  log('🤖 Robot behavior:');
  await helpers.tap(180, 300);
  await helpers.tap(180, 400);
  await helpers.tap(180, 500);
  await helpers.type('This is typed instantly');
  // ^ This looks like a bot!

  await helpers.sleep(5000);

  // HUMAN (Realistic - UNDETECTABLE)
  log('👤 Human behavior:');
  await human.tap(180, 300); // Random offset + delays
  await human.think();        // Pause
  await human.tap(180, 400);
  await human.delay(300, 800);
  await human.tap(180, 500);
  await human.type('This is typed with variable speed');
  // ^ This looks like a real person!

  log('✅ See the difference?');
}

// ========================================
// EXAMPLE 6: All Human Helpers
// ========================================

async function demonstrateAllHumanHelpers() {
  log('📚 Demonstrating all human helpers...');

  // 1. Basic tap
  await human.tap(180, 300);

  // 2. Quick tap (less delay)
  await human.quickTap(180, 300);

  // 3. Slow tap (more careful)
  await human.slowTap(180, 300);

  // 4. Tap with custom options
  await human.tap(180, 300, {
    preTapDelay: [200, 400],
    postTapDelay: [300, 600],
    offsetRange: 25
  });

  // 5. Human typing
  await human.type('Hello world!');

  // 6. Typing with options
  await human.type('Slower typing...', {
    charDelay: [150, 300],
    pauseChance: 0.1 // 10% pause chance
  });

  // 7. Human swipe (with curve)
  await human.swipe(180, 500, 180, 200);

  // 8. Swipe with options
  await human.swipe(180, 500, 180, 200, {
    addCurve: true,
    wobble: true
  });

  // 9. Human scroll
  await human.scroll(300); // Scroll down 300px

  // 10. Scroll up
  await human.scroll(-300);

  // 11. Thinking delay
  await human.think(); // 800-2000ms

  // 12. Reading delay
  await human.read(100); // Based on text length

  // 13. Random delay
  await human.delay(500, 1500);

  // 14. Random offset
  const offset = human.randomOffset(-10, 10);

  // 15. Idle behavior
  await human.idle(5000); // Random movements for 5s

  log('✅ All helpers demonstrated!');
}

// ========================================
// MAIN EXECUTION
// ========================================

// Uncomment the example you want to run:

// await humanTwitterLogin();
// await humanReadTimeline();
// await humanLikeTweets();
// await humanPostTweet('Hello from human-like automation! 🤖');
// await compareHumanVsBasic();
// await demonstrateAllHumanHelpers();

// Default: Run Twitter login example
await humanTwitterLogin();

log('🎉 Script completed!');
