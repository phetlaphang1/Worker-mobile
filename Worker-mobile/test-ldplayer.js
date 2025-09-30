/**
 * Test Script for LDPlayer Profile Management
 * 
 * This script tests:
 * 1. Creating a profile
 * 2. Activating the profile (launching LDPlayer instance)
 * 3. Basic automation (tap, swipe, input text)
 * 4. Deactivating the profile
 */

import LDPlayerController from './server/core/LDPlayerController.js';
import ProfileManager from './server/services/ProfileManager.js';
import { logger } from './server/utils/logger.js';

async function testLDPlayerAutomation() {
  try {
    console.log('🚀 Starting LDPlayer Automation Test...\n');

    // Initialize controller and profile manager
    const controller = new LDPlayerController();
    const profileManager = new ProfileManager(controller);

    console.log('📋 Step 1: Creating a test profile...');
    const profile = await profileManager.createProfile({
      name: 'Test Profile 1',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      },
      network: {
        useProxy: false
      },
      location: {
        latitude: 21.028511,
        longitude: 105.804817  // Hanoi, Vietnam
      }
    });

    console.log(`✅ Profile created: ${profile.name} (ID: ${profile.id})`);
    console.log(`   Instance: ${profile.instanceName}`);
    console.log(`   Port: ${profile.port}\n`);

    console.log('📋 Step 2: Activating profile (launching LDPlayer)...');
    await profileManager.activateProfile(profile.id);
    console.log('✅ Profile activated! LDPlayer instance is running\n');

    // Wait for instance to be fully ready
    console.log('⏳ Waiting 5 seconds for instance to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📋 Step 3: Testing basic automation...\n');

    // Test 1: Tap at center of screen
    console.log('   🖱️  Test 1: Tapping at center (360, 640)');
    await controller.tap(profile.port, 360, 640);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Tap successful\n');

    // Test 2: Swipe down (pull down notification)
    console.log('   👆 Test 2: Swiping down (notification shade)');
    await controller.swipe(profile.port, 360, 100, 360, 800, 500);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Swipe successful\n');

    // Test 3: Press Home button
    console.log('   🏠 Test 3: Pressing HOME button');
    await controller.pressKey(profile.port, 'KEYCODE_HOME');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Key press successful\n');

    // Test 4: Take screenshot
    console.log('   📸 Test 4: Taking screenshot');
    const screenshotPath = './test-screenshot.png';
    await controller.screenshot(profile.port, screenshotPath);
    console.log(`   ✅ Screenshot saved to ${screenshotPath}\n`);

    console.log('📋 Step 4: Deactivating profile...');
    await profileManager.deactivateProfile(profile.id);
    console.log('✅ Profile deactivated! LDPlayer instance stopped\n');

    console.log('📋 Step 5: Cleaning up (deleting test profile)...');
    await profileManager.deleteProfile(profile.id);
    console.log('✅ Test profile deleted\n');

    console.log('🎉 All tests completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Profile creation: PASSED');
    console.log('   ✅ Profile activation: PASSED');
    console.log('   ✅ Tap automation: PASSED');
    console.log('   ✅ Swipe automation: PASSED');
    console.log('   ✅ Key press: PASSED');
    console.log('   ✅ Screenshot: PASSED');
    console.log('   ✅ Profile deactivation: PASSED');
    console.log('   ✅ Profile deletion: PASSED');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testLDPlayerAutomation();
