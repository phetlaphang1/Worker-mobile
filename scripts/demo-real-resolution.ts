/**
 * Demo script to show real resolution anti-detect feature
 * This will apply fingerprint via ldconsole (instance stopped),
 * then launch and verify the dual-resolution system
 */

import 'dotenv/config';
import LDPlayerController from '../server/core/LDPlayerController.js';
import FingerprintService from '../server/services/FingerprintService.js';
import { FingerprintGenerator } from '../server/services/FingerprintGenerator.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function demoRealResolution() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 Real Resolution Anti-Detect Feature Demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const ldController = new LDPlayerController();
  const fingerprintService = new FingerprintService(ldController);

  // Load instances
  await ldController.getAllInstancesFromLDConsole();

  const instanceName = 'test21323';
  const instance = ldController.getInstance(instanceName);

  if (!instance) {
    console.log('❌ Instance not found');
    return;
  }

  console.log(`📱 Target Instance: ${instanceName}`);
  console.log(`   Current Status: ${instance.status}\n`);

  // Generate Samsung fingerprint
  const fingerprint = FingerprintGenerator.generateFingerprint({
    brand: 'samsung',
    includePhoneNumber: true
  });

  console.log('🎲 Generated Device Fingerprint:');
  console.log(`   Brand: ${fingerprint.brand}`);
  console.log(`   Model: ${fingerprint.model}`);
  console.log(`   Real Resolution: ${fingerprint.realResolution}`);
  console.log(`   Real DPI: ${fingerprint.realDpi}`);
  console.log(`   IMEI: ${fingerprint.imei}`);
  console.log(`   Android ID: ${fingerprint.androidId}\n`);

  // Apply via ldconsole (instance must be stopped)
  if (instance.status === 'running') {
    console.log('⏸️  Stopping instance...');
    await ldController.stopInstance(instanceName);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('⚙️  Applying fingerprint via ldconsole...');
  await fingerprintService.applyFingerprint(instanceName, fingerprint, {
    method: 'ldconsole',
    requireRestart: false
  });
  console.log('✅ Fingerprint applied\n');

  // Launch instance
  console.log('▶️  Launching instance...');
  await ldController.launchInstance(instanceName);
  console.log('✅ Instance launched\n');

  // Wait for instance to stabilize
  console.log('⏳ Waiting for instance to stabilize (30s)...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Get ADB port
  const runningInstance = ldController.getInstance(instanceName);
  const port = runningInstance?.port;

  if (!port) {
    console.log('❌ Failed to get ADB port');
    return;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('📊 Verification - What Apps Will Detect:\n');

  try {
    const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

    // Connect ADB
    console.log(`🔌 Connecting ADB to port ${port}...`);
    try {
      await execAsync(`"${adbPath}" connect 127.0.0.1:${port}`);
    } catch (e) {
      // Ignore connection errors, continue
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Need to apply resolution via ADB since ldconsole doesn't support wm commands
    console.log(`\n⚙️  Applying real resolution via ADB...`);
    const [width, height] = fingerprint.realResolution!.split('x');

    try {
      await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm size ${width}x${height}`);
      await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm density ${fingerprint.realDpi}`);
      console.log(`✅ Real resolution applied: ${fingerprint.realResolution} @ ${fingerprint.realDpi}dpi\n`);
    } catch (error: any) {
      console.log(`⚠️  Error applying resolution: ${error.message}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify settings
    console.log('📏 Display Settings (What Apps See):');
    try {
      const sizeResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm size`);
      console.log(`   ${sizeResult.stdout.trim()}`);

      const densityResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell wm density`);
      console.log(`   ${densityResult.stdout.trim()}`);

      // Check device properties
      console.log(`\n📱 Device Properties:`);
      const modelResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell getprop ro.product.model`);
      console.log(`   Model: ${modelResult.stdout.trim()}`);

      const manufacturerResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell getprop ro.product.manufacturer`);
      console.log(`   Manufacturer: ${manufacturerResult.stdout.trim()}`);

      const brandResult = await execAsync(`"${adbPath}" -s 127.0.0.1:${port} shell getprop ro.product.brand`);
      console.log(`   Brand: ${brandResult.stdout.trim()}`);
    } catch (error: any) {
      console.log(`   ⚠️  Error reading settings: ${error.message}`);
    }

  } catch (error: any) {
    console.log(`❌ Error during verification: ${error.message}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('\n✅ Demo Complete!\n');
  console.log('📝 How It Works:');
  console.log('   1. LDPlayer window: 360x640 (saves RAM)');
  console.log('   2. System reports: 1080x2400 @ 450dpi');
  console.log('   3. Apps detect: Samsung Galaxy S21');
  console.log('   4. Anti-detect: Apps see real device specs\n');
  console.log('💡 The dual-resolution system defeats emulator detection!');
  console.log('   Apps check DisplayMetrics and see real resolution,');
  console.log('   but LDPlayer only uses memory for 360x640 display.\n');
}

// Run the demo
demoRealResolution()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
