/**
 * Auto-enable USB Debugging for LDPlayer instances via ADB
 *
 * This script automatically enables Developer Options and USB Debugging
 * for instances that don't have it enabled yet.
 *
 * ⚠️ WARNING: This requires root access (LDPlayer instances are rooted by default)
 */

import { execSync } from 'child_process';

const LDCONSOLE_PATH = 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
const ADB_PATH = 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

interface LDInstance {
  index: number;
  name: string;
  isRunning: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllInstances(): LDInstance[] {
  const result = execSync(`"${LDCONSOLE_PATH}" list2`).toString();
  const lines = result.trim().split('\n');

  let runningResult = '';
  try {
    runningResult = execSync(`"${LDCONSOLE_PATH}" runninglist`).toString();
  } catch (error) {
    // No running instances
  }
  const runningNames = runningResult.trim().split('\n').filter(n => n.length > 0);

  const instances: LDInstance[] = [];

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const index = parseInt(parts[0], 10);
    const name = parts[1];

    // Skip invalid instances
    if (!name || name.includes('NaN') || name === '111') continue;

    const isRunning = runningNames.includes(name);

    instances.push({
      index,
      name,
      isRunning
    });
  }

  return instances;
}

function getAdbPort(instanceName: string): number | null {
  try {
    // Get ADB port from ldconsole
    const result = execSync(`"${LDCONSOLE_PATH}" getprop --name "${instanceName}" --key "adb_debug_port"`).toString();
    const port = parseInt(result.trim(), 10);

    if (isNaN(port) || port === 0) {
      return null;
    }

    return port;
  } catch (error) {
    return null;
  }
}

function isAdbConnected(port: number): boolean {
  try {
    const result = execSync(`"${ADB_PATH}" devices`).toString();
    return result.includes(`127.0.0.1:${port}`);
  } catch (error) {
    return false;
  }
}

function enableDeveloperOptions(port: number): boolean {
  try {
    console.log(`  🔧 Enabling Developer Options...`);

    // Enable developer settings
    execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} shell settings put global development_settings_enabled 1`, {
      stdio: 'ignore'
    });

    console.log(`  ✅ Developer Options enabled`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to enable Developer Options: ${error}`);
    return false;
  }
}

function enableUsbDebugging(port: number): boolean {
  try {
    console.log(`  🔧 Enabling USB Debugging...`);

    // Enable ADB
    execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} shell setprop persist.sys.usb.config adb`, {
      stdio: 'ignore'
    });

    // Enable USB debugging in settings
    execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} shell settings put global adb_enabled 1`, {
      stdio: 'ignore'
    });

    console.log(`  ✅ USB Debugging enabled`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to enable USB Debugging: ${error}`);
    return false;
  }
}

async function enableForInstance(instance: LDInstance): Promise<boolean> {
  console.log(`\n📱 Processing: ${instance.name} (index: ${instance.index})`);

  // Check if instance is running
  if (!instance.isRunning) {
    console.log(`  ⚠️  Instance is not running, launching...`);
    try {
      execSync(`"${LDCONSOLE_PATH}" launch --index ${instance.index}`, {
        stdio: 'ignore'
      });
      console.log(`  ⏳ Waiting 30 seconds for instance to boot...`);
      await sleep(30000);
    } catch (error) {
      console.error(`  ❌ Failed to launch instance: ${error}`);
      return false;
    }
  }

  // Enable ADB debugging in LDPlayer settings
  console.log(`  🔧 Enabling ADB in LDPlayer settings...`);
  try {
    execSync(`"${LDCONSOLE_PATH}" setprop --name "${instance.name}" --key "adb.debug" --value "1"`, {
      stdio: 'ignore'
    });
    console.log(`  ✅ ADB enabled in LDPlayer`);
  } catch (error) {
    console.error(`  ❌ Failed to enable ADB in LDPlayer: ${error}`);
    return false;
  }

  // Get ADB port
  await sleep(2000);
  const adbPort = getAdbPort(instance.name);
  if (!adbPort) {
    console.error(`  ❌ Could not get ADB port`);
    return false;
  }

  console.log(`  📡 ADB port: ${adbPort}`);

  // Connect to instance via ADB
  console.log(`  🔌 Connecting to instance via ADB...`);
  try {
    execSync(`"${ADB_PATH}" connect 127.0.0.1:${adbPort}`, {
      stdio: 'ignore'
    });
    await sleep(2000);

    if (!isAdbConnected(adbPort)) {
      console.error(`  ❌ Failed to connect to ADB`);
      return false;
    }

    console.log(`  ✅ ADB connected`);
  } catch (error) {
    console.error(`  ❌ ADB connection failed: ${error}`);
    return false;
  }

  // Enable Developer Options and USB Debugging
  const devOptionsOk = enableDeveloperOptions(adbPort);
  const usbDebuggingOk = enableUsbDebugging(adbPort);

  if (devOptionsOk && usbDebuggingOk) {
    console.log(`  ✅ ${instance.name} - USB Debugging fully enabled!`);
    return true;
  } else {
    console.log(`  ⚠️  ${instance.name} - Partial success (may need manual verification)`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔧 Auto-Enable USB Debugging for LDPlayer Instances');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get all instances
    const instances = getAllInstances();
    console.log(`📋 Found ${instances.length} instances\n`);

    if (instances.length === 0) {
      console.log('⚠️  No instances found');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const instance of instances) {
      const success = await enableForInstance(instance);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Wait between instances
      if (instances.indexOf(instance) < instances.length - 1) {
        await sleep(2000);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`✅ Success: ${successCount}/${instances.length}`);
    console.log(`❌ Failed: ${failCount}/${instances.length}`);

    if (failCount === 0) {
      console.log('\n🎉 All instances now have USB Debugging enabled!');
      console.log('💡 You can now run scripts on all instances.');
    } else {
      console.log('\n⚠️  Some instances failed. You may need to:');
      console.log('   1. Manually enable Developer Options (tap Build Number 7 times)');
      console.log('   2. Manually toggle USB Debugging in Settings > Developer Options');
      console.log('   3. Restart server: npm run pm2:restart');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
