/**
 * Example: Basic Mobile Actions with Puppeteer-like API
 *
 * Demonstrates common mobile automation patterns using
 * the familiar Puppeteer API on Android/LDPlayer
 */

async function main() {
  log('Starting basic mobile automation demo...');

  // === EXAMPLE 1: Launch App ===
  log('Example 1: Launching app...');
  await page.goto('com.android.settings'); // Android Settings app
  await helpers.sleep(2000);
  await helpers.screenshot('settings_app.png');

  // === EXAMPLE 2: Click Element by Text ===
  log('Example 2: Finding and clicking element by text...');
  const searchElement = await helpers.findByText('Search');
  if (searchElement) {
    await searchElement.click();
    log('Clicked on Search');
  }
  await helpers.sleep(1000);

  // === EXAMPLE 3: Type Text ===
  log('Example 3: Typing text...');
  await page.type(
    'android=new UiSelector().className("android.widget.EditText")',
    'wifi',
    { delay: 100 } // Delay between keystrokes for human-like typing
  );
  await helpers.sleep(1000);
  await helpers.screenshot('search_typed.png');

  // === EXAMPLE 4: Tap by Coordinates ===
  log('Example 4: Tapping by coordinates...');
  await page.tap(540, 300); // Center-ish area
  await helpers.sleep(1000);

  // === EXAMPLE 5: Swipe Gestures ===
  log('Example 5: Swipe gestures...');

  // Scroll down
  await page.scrollDown();
  await helpers.sleep(500);

  // Scroll up
  await page.scrollUp();
  await helpers.sleep(500);

  // Custom swipe
  await page.swipe(
    540, 1000,  // Start: center X, bottom
    540, 500,   // End: center X, middle
    300         // Duration in ms
  );
  await helpers.sleep(500);

  // === EXAMPLE 6: Wait for Element ===
  log('Example 6: Waiting for element...');
  try {
    await page.waitForSelector('~Settings', { timeout: 5000 });
    log('Settings element found!');
  } catch (error) {
    log('Settings element not found within timeout');
  }

  // === EXAMPLE 7: Get Element Text ===
  log('Example 7: Getting element text...');
  const titleText = await page.textContent('android=new UiSelector().className("android.widget.TextView").instance(0)');
  log(`Title text: ${titleText}`);

  // === EXAMPLE 8: Check Element Visibility ===
  log('Example 8: Checking element visibility...');
  const isVisible = await page.isVisible('~Search');
  log(`Search is visible: ${isVisible}`);

  // === EXAMPLE 9: Navigate Using Android Buttons ===
  log('Example 9: Android navigation...');
  await page.goBack(); // Press back button
  await helpers.sleep(1000);

  await page.goHome(); // Press home button
  await helpers.sleep(1000);

  // === EXAMPLE 10: Advanced - Multiple Element Interaction ===
  log('Example 10: Multiple elements...');
  await page.goto('com.android.settings');
  await helpers.sleep(2000);

  const allTextViews = await page.$$('android=new UiSelector().className("android.widget.TextView")');
  log(`Found ${allTextViews.length} text views`);

  // Iterate through elements
  for (let i = 0; i < Math.min(3, allTextViews.length); i++) {
    const text = await allTextViews[i].getText();
    log(`  ${i + 1}. ${text}`);
  }

  // === EXAMPLE 11: Take Multiple Screenshots ===
  log('Example 11: Taking screenshots...');
  await helpers.screenshot('final_screen_1.png');
  await page.scrollDown();
  await helpers.screenshot('final_screen_2.png');

  // === EXAMPLE 12: Install and Launch APK ===
  log('Example 12: Install APK (if path provided)...');
  // Uncomment to use:
  // await helpers.installAPK('/path/to/app.apk');
  // await helpers.launchApp('com.example.app');

  log('Basic mobile actions demo completed!');

  return {
    success: true,
    message: 'All examples executed successfully',
    examplesRun: 12
  };
}

// Execute main function
return await main();
