/**
 * Example: Browser (Puppeteer) to Mobile (Appium) Conversion Guide
 *
 * This file shows how to convert browser automation scripts
 * to mobile automation scripts using the same API
 */

/*
========================================
PUPPETEER (BROWSER) VERSION
========================================

// Launch browser and navigate
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://twitter.com/login');

// Click element
await page.click('[name="session[username_or_email]"]');

// Type text
await page.type('[name="session[username_or_email]"]', 'myusername');

// Wait for selector
await page.waitForSelector('[data-testid="LoginForm_Login_Button"]');

// Get text content
const text = await page.$eval('h1', el => el.textContent);

// Take screenshot
await page.screenshot({ path: 'screenshot.png' });

// Scroll
await page.evaluate(() => window.scrollBy(0, 500));

await browser.close();

========================================
MOBILE (APPIUM) VERSION with MobilePage
========================================
*/

async function main() {
  log('Starting browser-to-mobile conversion example...');

  // ✅ CONVERTED: Launch app (equivalent to goto URL)
  // BROWSER: await page.goto('https://twitter.com');
  // MOBILE:
  await page.goto('com.twitter.android');
  await helpers.sleep(2000);

  // ✅ CONVERTED: Click element
  // BROWSER: await page.click('[name="username"]');
  // MOBILE: Use accessibility ID, XPath, or UiAutomator
  await page.click('~username_field'); // Accessibility ID
  // OR
  // await page.click('android=new UiSelector().resourceId("com.twitter.android:id/username")');
  // OR
  // await page.click('//android.widget.EditText[@resource-id="username"]');

  // ✅ CONVERTED: Type text
  // BROWSER: await page.type('input[name="username"]', 'myusername');
  // MOBILE:
  await page.type(
    'android=new UiSelector().className("android.widget.EditText")',
    'myusername',
    { delay: 50 } // Optional: human-like typing
  );
  await helpers.sleep(500);

  // ✅ CONVERTED: Wait for selector
  // BROWSER: await page.waitForSelector('button[type="submit"]');
  // MOBILE:
  await page.waitForSelector('~login_button', { timeout: 10000 });

  // ✅ CONVERTED: Get text content
  // BROWSER: const text = await page.$eval('h1', el => el.textContent);
  // MOBILE:
  const text = await page.textContent('android=new UiSelector().className("android.widget.TextView").instance(0)');
  log(`Text content: ${text}`);

  // ✅ CONVERTED: Take screenshot
  // BROWSER: await page.screenshot({ path: 'screenshot.png' });
  // MOBILE:
  await page.screenshot({ path: 'screenshot.png' });
  // OR use helper:
  await helpers.screenshot('my_screenshot.png');

  // ✅ CONVERTED: Scroll
  // BROWSER: await page.evaluate(() => window.scrollBy(0, 500));
  // MOBILE: Use swipe/scroll methods
  await page.scrollDown(); // Scroll down
  await page.scrollUp();   // Scroll up
  // OR custom swipe:
  await page.swipe(540, 1000, 540, 500, 300);

  // ✅ CONVERTED: Find multiple elements
  // BROWSER: const links = await page.$$('a');
  // MOBILE:
  const buttons = await page.$$('android=new UiSelector().className("android.widget.Button")');
  log(`Found ${buttons.length} buttons`);

  // ✅ CONVERTED: Check element visibility
  // BROWSER: const visible = await page.$eval('#element', el => el.offsetHeight > 0);
  // MOBILE:
  const isVisible = await page.isVisible('~my_element');
  log(`Element visible: ${isVisible}`);

  // ✅ NEW: Mobile-specific - Press Android keys
  // No browser equivalent
  await page.pressKey('KEYCODE_BACK');
  await helpers.sleep(500);
  await page.pressKey('KEYCODE_HOME');

  // ✅ NEW: Mobile-specific - Tap by coordinates
  // BROWSER: await page.mouse.click(100, 200);
  // MOBILE:
  await page.tap(540, 960); // Tap at center
  // OR
  await helpers.tapWithOffset(540, 960, 10, 5); // With random offset

  // ✅ NEW: Mobile-specific - Swipe gestures
  // No direct browser equivalent
  await helpers.swipeLeft();
  await helpers.sleep(500);
  await helpers.swipeRight();

  // ✅ NEW: Mobile-specific - App management
  await helpers.launchApp('com.android.settings');
  await helpers.sleep(2000);
  const currentApp = await helpers.getCurrentApp();
  log(`Current app: ${currentApp}`);

  // ✅ NEW: Mobile-specific - Install APK
  // await helpers.installAPK('/path/to/app.apk');

  log('Conversion example completed!');

  /*
  ========================================
  SELECTOR CONVERSION GUIDE
  ========================================

  BROWSER CSS SELECTORS → MOBILE SELECTORS

  1. ID Selector:
     Browser: '#username'
     Mobile:  'android=new UiSelector().resourceId("username")'
     Or:      '~username' (if it's an accessibility ID)

  2. Class Selector:
     Browser: '.btn-primary'
     Mobile:  'android=new UiSelector().className("android.widget.Button")'

  3. Attribute Selector:
     Browser: '[data-testid="login-button"]'
     Mobile:  'android=new UiSelector().description("login-button")'
     Or:      '~login-button'

  4. Text Content:
     Browser: await page.$eval('button', el => el.textContent === 'Login')
     Mobile:  await helpers.findByText('Login')
     Or:      'android=new UiSelector().text("Login")'

  5. XPath:
     Browser: '//button[@class="submit"]'
     Mobile:  '//android.widget.Button[@text="Submit"]'

  ========================================
  KEY DIFFERENCES
  ========================================

  1. No DOM/HTML on mobile - use UI hierarchy instead
  2. Use Android selectors (UiAutomator, accessibility ID, XPath)
  3. Gestures (swipe, pinch) replace mouse movements
  4. App launch replaces URL navigation
  5. Android keys (BACK, HOME) for navigation
  6. Less JavaScript evaluation (no browser console)

  ========================================
  */

  return {
    success: true,
    message: 'Conversion examples completed',
    tip: 'Check the comments in this script for detailed conversion guide'
  };
}

// Execute
return await main();
