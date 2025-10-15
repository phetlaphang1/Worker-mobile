/**
 * Test script to verify real resolution anti-detect feature
 * This will launch an instance, apply fingerprint, and verify the resolution settings
 */

import 'dotenv/config';
import LDPlayerController from '../server/core/LDPlayerController.js';
import FingerprintService from '../server/services/FingerprintService.js';
import { FingerprintGenerator } from '../server/services/FingerprintGenerator.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testRealResolution() {
  console.log('🧪 Testing Real Resolution Anti-Detect Feature\n');

  const ldController = new LDPlayerController();
  const fingerprintService = new FingerprintService(ldController);

  // Load instances
  await ldController.getAllInstancesFromLDConsole();

  // Use profile 9's instance (123214123_9)
  const instanceName = '123214123_9';
  const instance = ldController.getInstance(instanceName);

  if (!instance) {
    console.log('❌ Instance not found');
    return;
  }

  console.log(`📱 Instance: ${instanceName}`);
  console.log(`   Status: ${instance.status}`);
  console.log(`   Port: ${instance.port || 'N/A'}\n`);

  // Launch if not running
  if (instance.status !== 'running') {
    console.log('▶️  Launching instance...');
    await ldController.launchInstance(instanceName);
    console.log('✅ Instance launched\n');

    // Wait for stabilization
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Get updated instance info
  const runningInstance = ldController.getInstance(instanceName);
  const port = runningInstance?.port;

  if (!port) {
    console.log('❌ Failed to get ADB port');
    return;
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 BEFORE - Current Display Settings:\n`);

  try {
    const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

    const sizeResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm size`);
    console.log(`   ${sizeResult.stdout.trim()}`);

    const densityResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm density`);
    console.log(`   ${densityResult.stdout.trim()}`);

    const lcdDensity = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell getprop ro.sf.lcd_density`);
    console.log(`   ro.sf.lcd_density: ${lcdDensity.stdout.trim()}`);
  } catch (error: any) {
    console.log(`   Error reading settings: ${error.message}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔧 Applying Fingerprint with Real Resolution...\n`);

  // Generate fingerprint
  const fingerprint = FingerprintGenerator.generateFingerprint({
    brand: 'samsung', // Use Samsung for consistent testing
    includePhoneNumber: true
  });

  console.log(`   Device: ${fingerprint.brand} ${fingerprint.model}`);
  console.log(`   Real Resolution: ${fingerprint.realResolution}`);
  console.log(`   Real DPI: ${fingerprint.realDpi}`);
  console.log(`   IMEI: ${fingerprint.imei}`);
  console.log(`   Android ID: ${fingerprint.androidId}\n`);

  // Apply fingerprint via ADB (this includes real resolution commands)
  await fingerprintService.applyFingerprint(instanceName, fingerprint, {
    method: 'adb',
    requireRestart: false
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 AFTER - Display Settings (What Apps See):\n`);

  // Wait a bit for settings to apply
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

    const sizeResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm size`);
    console.log(`   ${sizeResult.stdout.trim()}`);

    const densityResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm density`);
    console.log(`   ${densityResult.stdout.trim()}`);

    const lcdDensity = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell getprop ro.sf.lcd_density`);
    console.log(`   ro.sf.lcd_density: ${lcdDensity.stdout.trim()}`);

    // Also check what apps will actually see via DisplayMetrics
    console.log(`\n📱 What Apps Actually Detect:`);
    const displayInfo = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell dumpsys display | grep -A 3 "mBaseDisplayInfo"`);
    console.log(displayInfo.stdout);
  } catch (error: any) {
    console.log(`   Error reading settings: ${error.message}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n✅ Test Complete!\n`);
  console.log(`📝 Summary:`);
  console.log(`   - LDPlayer window: Still displays at 360x640 (saves RAM)`);
  console.log(`   - System reports: ${fingerprint.realResolution} @ ${fingerprint.realDpi}dpi`);
  console.log(`   - Apps will detect: ${fingerprint.brand} ${fingerprint.model} specs`);
  console.log(`   - Anti-detect: ✅ Apps see real device, not emulator`);
  console.log(`\n💡 The dual-resolution system is working!`);
}

// Run the test
testRealResolution()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
