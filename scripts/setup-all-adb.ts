/**
 * Script to setup ADB for ALL running LDPlayer instances
 * Run this script to prepare all instances for automation
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LDCONSOLE_PATH = 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
const ADB_PATH = 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
const PROFILES_DIR = 'D:\\BArmy\\Worker-mobile\\data\\profiles';

interface InstanceInfo {
  index: number;
  name: string;
  isRunning: boolean;
  adbPort?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllInstances(): Promise<InstanceInfo[]> {
  console.log('📋 Getting all instances...');

  // Get list of all instances
  const listResult = execSync(`"${LDCONSOLE_PATH}" list2`).toString();
  const lines = listResult.trim().split('\n');

  // Get running instances
  const runningResult = execSync(`"${LDCONSOLE_PATH}" runninglist`).toString();
  const runningNames = runningResult.trim().split('\n').filter(n => n.length > 0);

  const instances: InstanceInfo[] = [];

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const index = parseInt(parts[0], 10);
    const name = parts[1];

    // Skip invalid instances
    if (!name || name === 'Instance_NaN' || name.includes('NaN')) {
      continue;
    }

    const isRunning = runningNames.includes(name);

    instances.push({
      index,
      name,
      isRunning
    });
  }

  console.log(`✅ Found ${instances.length} instances (${instances.filter(i => i.isRunning).length} running)`);
  return instances;
}

async function enableADBForInstance(instanceName: string): Promise<void> {
  console.log(`  🔧 Enabling ADB for: ${instanceName}`);
  try {
    execSync(`"${LDCONSOLE_PATH}" setprop --name "${instanceName}" --key "adb.debug" --value "1"`, {
      stdio: 'ignore'
    });
    console.log(`  ✅ ADB enabled for ${instanceName}`);
  } catch (error) {
    console.log(`  ⚠️ Warning: Could not enable ADB for ${instanceName}`);
  }
}

async function rebootInstance(instanceName: string): Promise<void> {
  console.log(`  🔄 Rebooting: ${instanceName}`);
  try {
    execSync(`"${LDCONSOLE_PATH}" reboot --name "${instanceName}"`, {
      stdio: 'ignore'
    });
    console.log(`  ⏳ Waiting for ${instanceName} to boot (30 seconds)...`);
    await sleep(30000);
  } catch (error) {
    console.log(`  ⚠️ Warning: Could not reboot ${instanceName}`);
  }
}

async function findADBPort(instanceName: string): Promise<number | null> {
  console.log(`  🔍 Finding ADB port for: ${instanceName}`);

  // Kill and restart ADB server
  try {
    execSync(`"${ADB_PATH}" kill-server`, { stdio: 'ignore' });
    await sleep(1000);
    execSync(`"${ADB_PATH}" start-server`, { stdio: 'ignore' });
    await sleep(2000);
  } catch (error) {
    // Ignore
  }

  // Try to connect to common ports
  const portsToTry = [5555, 5557, 5559, 5561, 5563, 5565, 5567, 5569, 5571, 5573, 5575, 5577, 5579, 5581, 5583, 5585];

  for (const port of portsToTry) {
    try {
      execSync(`"${ADB_PATH}" connect 127.0.0.1:${port}`, { stdio: 'ignore' });
      await sleep(500);
    } catch (error) {
      // Port not available
      continue;
    }
  }

  // Check connected devices
  try {
    const devicesResult = execSync(`"${ADB_PATH}" devices`).toString();
    const lines = devicesResult.trim().split('\n').slice(1);

    // Get all connected ports
    const connectedPorts: number[] = [];
    for (const line of lines) {
      const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
      const emulatorMatch = line.match(/emulator-(\d+)\s+device/);

      if (ipMatch) {
        connectedPorts.push(parseInt(ipMatch[1], 10));
      } else if (emulatorMatch) {
        connectedPorts.push(parseInt(emulatorMatch[1], 10));
      }
    }

    if (connectedPorts.length > 0) {
      // Test each port to find the right one
      for (const port of connectedPorts) {
        try {
          const testResult = execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} shell getprop ro.product.model`, {
            timeout: 3000
          }).toString();

          if (testResult.trim().length > 0) {
            console.log(`  ✅ Found ADB port: ${port}`);
            return port;
          }
        } catch (error) {
          continue;
        }
      }

      // Fallback to first connected port
      console.log(`  ⚠️ Using first available port: ${connectedPorts[0]}`);
      return connectedPorts[0];
    }
  } catch (error) {
    console.log(`  ❌ Could not find ADB port for ${instanceName}`);
  }

  return null;
}

async function updateProfilePort(instanceName: string, port: number): Promise<void> {
  console.log(`  💾 Updating profile port to ${port}...`);

  // Find profile with matching instanceName
  const files = fs.readdirSync(PROFILES_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(PROFILES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const profile = JSON.parse(content);

    if (profile.instanceName === instanceName) {
      profile.port = port;
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
      console.log(`  ✅ Updated profile ID ${profile.id} with port ${port}`);
      return;
    }
  }

  console.log(`  ⚠️ No profile found for instance: ${instanceName}`);
}

async function setupInstance(instance: InstanceInfo): Promise<void> {
  console.log(`\n🚀 Setting up instance: ${instance.name} (index: ${instance.index})`);

  if (!instance.isRunning) {
    console.log(`  ⚠️ Instance is not running, skipping...`);
    return;
  }

  // Step 1: Enable ADB
  await enableADBForInstance(instance.name);

  // Step 2: Reboot to apply ADB settings
  await rebootInstance(instance.name);

  // Step 3: Find ADB port
  const port = await findADBPort(instance.name);

  if (port) {
    instance.adbPort = port;

    // Step 4: Update profile
    await updateProfilePort(instance.name, port);

    console.log(`✅ Instance ${instance.name} is ready! (port: ${port})`);
  } else {
    console.log(`❌ Failed to setup ${instance.name}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔧 LDPlayer ADB Setup Script');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get all instances
    const instances = await getAllInstances();

    // Filter only running instances
    const runningInstances = instances.filter(i => i.isRunning);

    if (runningInstances.length === 0) {
      console.log('\n⚠️ No running instances found!');
      console.log('Please start instances first, then run this script again.');
      return;
    }

    console.log(`\n🎯 Will setup ${runningInstances.length} running instances:\n`);
    runningInstances.forEach(i => {
      console.log(`  • ${i.name} (index: ${i.index})`);
    });

    console.log('\n⏳ Starting setup process...\n');

    // Setup each instance
    for (const instance of runningInstances) {
      await setupInstance(instance);
      await sleep(2000); // Wait between instances
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 SETUP SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');

    const successful = runningInstances.filter(i => i.adbPort);
    const failed = runningInstances.filter(i => !i.adbPort);

    console.log(`✅ Successful: ${successful.length}/${runningInstances.length}`);
    successful.forEach(i => {
      console.log(`   • ${i.name} → port ${i.adbPort}`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}/${runningInstances.length}`);
      failed.forEach(i => {
        console.log(`   • ${i.name}`);
      });
    }

    console.log('\n✅ Setup complete! You can now run scripts on all instances.');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
