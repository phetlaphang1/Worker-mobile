/**
 * EXAMPLE: Cloudflare Challenge Handling
 * Demonstrates how to detect and solve Cloudflare captchas in Twitter/X app
 *
 * Available in all scripts:
 * - cloudflare.detect() - Detect Cloudflare challenge
 * - cloudflare.wait() - Wait for JS challenge to pass
 * - cloudflare.solve() - Solve Turnstile captcha via API
 * - cloudflare.handle() - Auto-handle any Cloudflare challenge
 * - cloudflare.getBalance() - Check API balance
 */

// ========================================
// EXAMPLE 1: Auto-handle Cloudflare (Recommended)
// ========================================

async function autoHandleCloudflare() {
  log('🛡️ Twitter login with auto Cloudflare handling...');

  // Launch Twitter
  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Auto-handle any Cloudflare challenge
  const result = await cloudflare.handle({
    timeout: 30000,        // Wait max 30s for JS challenge
    solveIfNeeded: true    // Solve Turnstile via API if needed
  });

  if (result.success) {
    log(`✅ Cloudflare handled successfully! Action: ${result.action}`);

    if (result.action === 'solved') {
      log(`Token: ${result.solution}`);
      // Token is solved but you may need to apply it manually
      // For Twitter app, usually just reload/continue works
    }

  } else {
    log(`❌ Cloudflare handling failed: ${result.error}`);
    return;
  }

  // Continue with normal flow
  log('Continuing with Twitter login...');
  await helpers.sleep(2000);

  // Rest of your script...
}

// ========================================
// EXAMPLE 2: Manual Detection & Handling
// ========================================

async function manualCloudflareDetection() {
  log('🔍 Manual Cloudflare detection...');

  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Step 1: Detect
  const challenge = await cloudflare.detect();

  if (!challenge.detected) {
    log('✅ No Cloudflare challenge - continue normally');
    // Your normal script flow
    return;
  }

  log(`⚠️ Cloudflare ${challenge.type} detected!`);

  // Step 2: Handle based on type
  if (challenge.type === 'javascript') {
    // JavaScript challenge - wait for auto-pass
    log('Waiting for JavaScript challenge to pass...');
    const passed = await cloudflare.wait(30000);

    if (passed) {
      log('✅ Challenge passed automatically!');
    } else {
      log('❌ Challenge did not pass');
      return;
    }

  } else if (challenge.type === 'turnstile') {
    // Turnstile captcha - solve via API
    log('Solving Turnstile captcha via API...');

    const solution = await cloudflare.solve({
      sitekey: challenge.sitekey,
      pageurl: 'https://twitter.com',
      type: 'turnstile'
    });

    if (solution.success) {
      log(`✅ Captcha solved! Token: ${solution.solution}`);
      log(`Cost: $${solution.cost}, Time: ${solution.solveTime}ms`);
      // Apply token or reload page
    } else {
      log(`❌ Solve failed: ${solution.error}`);
      return;
    }

  } else if (challenge.type === 'blocked') {
    log('❌ Blocked by Cloudflare - cannot bypass');
    log('Try:');
    log('- Use different IP/proxy');
    log('- Use better fingerprint');
    log('- Use human-like behavior');
    return;
  }

  // Continue after handling
  log('Cloudflare handled - continuing...');
}

// ========================================
// EXAMPLE 3: Twitter Login with Cloudflare Protection
// ========================================

async function twitterLoginWithCloudflare() {
  log('🐦 Twitter login with full Cloudflare protection...');

  // Step 1: Launch app
  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Step 2: Check for Cloudflare
  log('Checking for Cloudflare challenge...');
  const cfResult = await cloudflare.handle({ timeout: 30000 });

  if (!cfResult.success) {
    log('❌ Failed to bypass Cloudflare');
    return { success: false, error: 'Cloudflare block' };
  }

  log('✅ Cloudflare check passed');

  // Step 3: Wait for login screen
  await helpers.sleep(2000);

  // Check for Cloudflare AGAIN (might appear after navigation)
  const cfRecheck = await cloudflare.detect();
  if (cfRecheck.detected) {
    log('⚠️ Cloudflare appeared again, handling...');
    await cloudflare.handle();
  }

  // Step 4: Continue with login
  await helpers.waitForText('Log in', { timeout: 10000 });

  const account = helpers.getAccount('twitter');
  if (!account) {
    log('❌ No Twitter account in profile');
    return { success: false, error: 'No account' };
  }

  // Use human-like behavior (less likely to trigger Cloudflare)
  await human.think();
  await human.tap(180, 500); // Tap "Log in"

  await helpers.sleep(2000);

  // Type username with human behavior
  await human.tap(180, 300);
  await helpers.sleep(500);
  await human.type(account.username);

  await human.think();
  await human.tap(180, 600); // Next

  await helpers.sleep(2000);

  // Type password
  await human.tap(180, 300);
  await helpers.sleep(500);
  await human.type(account.password);

  await human.think();
  await human.tap(180, 600); // Login

  // Wait and check for Cloudflare AFTER login
  await helpers.sleep(5000);
  const cfAfterLogin = await cloudflare.detect();

  if (cfAfterLogin.detected) {
    log('⚠️ Cloudflare appeared after login!');
    await cloudflare.handle();
  }

  log('✅ Login completed with Cloudflare protection!');
  return { success: true };
}

// ========================================
// EXAMPLE 4: Check API Balance
// ========================================

async function checkCaptchaBalance() {
  log('💰 Checking captcha solver API balance...');

  const balance = await cloudflare.getBalance();

  log(`Current balance: $${balance}`);

  if (balance < 1) {
    log('⚠️ Low balance! Please top up.');
    log('Visit: https://2captcha.com or https://capsolver.com');
  }

  return balance;
}

// ========================================
// EXAMPLE 5: Retry Logic with Cloudflare
// ========================================

async function retryWithCloudflare(action, maxRetries = 3) {
  log(`🔄 Executing action with Cloudflare retry (max: ${maxRetries})...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Attempt ${attempt}/${maxRetries}...`);

    try {
      // Execute action
      await action();

      // Check for Cloudflare
      const challenge = await cloudflare.detect();

      if (challenge.detected) {
        log(`⚠️ Cloudflare detected on attempt ${attempt}`);

        const handled = await cloudflare.handle();

        if (handled.success) {
          log(`✅ Cloudflare handled on attempt ${attempt}`);
          return { success: true, attempts: attempt };
        } else {
          log(`❌ Cloudflare handling failed on attempt ${attempt}`);

          if (attempt < maxRetries) {
            log(`Retrying in 5 seconds...`);
            await helpers.sleep(5000);
            continue;
          } else {
            return { success: false, error: 'Max retries reached' };
          }
        }
      } else {
        log(`✅ No Cloudflare - success on attempt ${attempt}`);
        return { success: true, attempts: attempt };
      }

    } catch (error) {
      log(`❌ Error on attempt ${attempt}: ${error.message}`);

      if (attempt < maxRetries) {
        await helpers.sleep(5000);
      } else {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: false, error: 'Unexpected failure' };
}

// ========================================
// EXAMPLE 6: Full Protection Stack
// ========================================

async function fullProtectionStack() {
  log('🛡️ Full anti-detect + Cloudflare protection...');

  // Layer 1: Device fingerprint (already applied via ProfileManager)
  log('✅ Layer 1: Device fingerprint active');

  // Layer 2: Human-like behavior
  log('✅ Layer 2: Human-like behavior enabled');

  // Layer 3: Cloudflare handling
  log('✅ Layer 3: Cloudflare handler ready');

  // Launch app with full protection
  await helpers.launchApp('com.twitter.android');
  await helpers.sleep(3000);

  // Auto-handle Cloudflare
  await cloudflare.handle();

  // Use human behavior for all interactions
  await human.think();
  await human.tap(180, 300);
  await human.delay(500, 1500);
  await human.type('Automated with full protection!');

  log('✅ Full protection stack in action!');
}

// ========================================
// EXAMPLE 7: Cloudflare Detection Loop
// ========================================

async function cloudflareDetectionLoop() {
  log('🔄 Running continuous Cloudflare detection...');

  let checksWithoutCaptcha = 0;
  const MAX_CHECKS = 10;

  for (let i = 1; i <= MAX_CHECKS; i++) {
    log(`Check ${i}/${MAX_CHECKS}...`);

    const challenge = await cloudflare.detect();

    if (challenge.detected) {
      log(`⚠️ Cloudflare ${challenge.type} detected!`);
      checksWithoutCaptcha = 0; // Reset counter

      // Handle it
      await cloudflare.handle();

    } else {
      log(`✅ No Cloudflare (${++checksWithoutCaptcha} checks clean)`);
    }

    // Perform some action
    await human.scroll(300);
    await human.read(100);

    await helpers.sleep(3000);
  }

  log(`✅ Completed ${MAX_CHECKS} checks (${checksWithoutCaptcha} clean)`);
}

// ========================================
// MAIN EXECUTION
// ========================================

// Uncomment the example you want to run:

// await autoHandleCloudflare();
// await manualCloudflareDetection();
// await twitterLoginWithCloudflare();
// await checkCaptchaBalance();
// await retryWithCloudflare(async () => {
//   await helpers.launchApp('com.twitter.android');
//   await helpers.sleep(3000);
// });
// await fullProtectionStack();
// await cloudflareDetectionLoop();

// Default: Auto-handle example
await twitterLoginWithCloudflare();

log('🎉 Script completed!');
