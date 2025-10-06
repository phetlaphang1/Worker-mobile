/**
 * Example: Twitter Mobile App Login using Puppeteer-like API
 *
 * This script demonstrates how to use the MobilePage adapter
 * which provides Puppeteer-like API for mobile automation
 */

// Script has access to: page, driver, config, helpers

async function main() {
  log('Starting Twitter mobile login automation...');

  // Launch Twitter app
  await page.goto('com.twitter.android');
  await helpers.sleep(3000);

  log('Twitter app launched');

  // Take screenshot
  await helpers.screenshot('01_app_launched.png');

  // Check if already logged in by looking for home feed
  const isLoggedIn = await page.isVisible('~Home');

  if (isLoggedIn) {
    log('Already logged in!');
    return { success: true, message: 'Already authenticated' };
  }

  log('Not logged in, proceeding with login...');

  // Click "Log in" button
  const loginButton = await helpers.findByText('Log in');
  if (loginButton) {
    await loginButton.click();
    await helpers.randomDelay(2000, 3000);
  }

  await helpers.screenshot('02_login_screen.png');

  // Enter username/email
  log('Entering username...');
  const usernameField = await helpers.findByText('Phone, email or username');

  if (usernameField) {
    await usernameField.click();
    await helpers.sleep(1000);

    // Get credentials from config
    const username = config.customField?.twitter_account?.username;
    if (!username) {
      throw new Error('No username found in config');
    }

    await page.type('android=new UiSelector().className("android.widget.EditText")', username);
    await helpers.sleep(1000);
  }

  await helpers.screenshot('03_username_entered.png');

  // Click Next
  const nextButton = await helpers.findByText('Next');
  if (nextButton) {
    await nextButton.click();
    await helpers.randomDelay(2000, 3000);
  }

  // Enter password
  log('Entering password...');
  const passwordField = await helpers.findByText('Password');

  if (passwordField) {
    await passwordField.click();
    await helpers.sleep(1000);

    const password = config.customField?.twitter_account?.password;
    if (!password) {
      throw new Error('No password found in config');
    }

    await page.type('android=new UiSelector().className("android.widget.EditText")', password);
    await helpers.sleep(1000);
  }

  await helpers.screenshot('04_password_entered.png');

  // Click Log in
  const loginSubmitButton = await helpers.findByText('Log in');
  if (loginSubmitButton) {
    await loginSubmitButton.click();
    await helpers.randomDelay(3000, 5000);
  }

  // Wait for home screen
  log('Waiting for home screen...');
  await page.waitForSelector('~Home', { timeout: 30000 });

  await helpers.screenshot('05_logged_in.png');

  log('Login successful!');

  return {
    success: true,
    message: 'Login completed successfully',
    username: config.customField?.twitter_account?.username
  };
}

// Execute main function
return await main();
