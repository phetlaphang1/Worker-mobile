/**
 * Script: Install Modded APK to LDPlayer Instances
 * Usage: npx tsx scripts/install-modded-apk.ts <apk-path> [instance-name]
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ADB_PATH = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
const LDCONSOLE_PATH = process.env.LDCONSOLE_PATH || 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';

interface LDInstance {
  index: number;
  name: string;
  port: number;
  status: 'running' | 'stopped';
}

/**
 * Get all LDPlayer instances
 */
function getLDInstances(): LDInstance[] {
  try {
    const output = execSync(`"${LDCONSOLE_PATH}" list2`, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');

    const instances: LDInstance[] = [];

    for (const line of lines) {
      const match = line.match(/^(\d+),([^,]+),/);
      if (match) {
        const index = parseInt(match[1]);
        const name = match[2].trim();

        // Get status
        const statusOutput = execSync(`"${LDCONSOLE_PATH}" isrunning --index ${index}`, { encoding: 'utf-8' });
        const status = statusOutput.includes('running') ? 'running' : 'stopped';

        // Get ADB port if running
        let port = 5555 + index * 2;
        if (status === 'running') {
          try {
            const portOutput = execSync(`"${LDCONSOLE_PATH}" getprop --index ${index} --key "adb_debug_port"`, { encoding: 'utf-8' });
            const portMatch = portOutput.match(/(\d{4,5})/);
            if (portMatch) {
              port = parseInt(portMatch[1]);
            }
          } catch (err) {
            // Use default port
          }
        }

        instances.push({ index, name, port, status });
      }
    }

    return instances;
  } catch (error) {
    console.error('❌ Failed to get LDPlayer instances:', error);
    return [];
  }
}

/**
 * Uninstall package from instance
 */
async function uninstallPackage(port: number, packageName: string): Promise<void> {
  try {
    console.log(`   Uninstalling ${packageName}...`);
    execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} uninstall ${packageName}`, { encoding: 'utf-8' });
    console.log(`   ✅ Uninstalled ${packageName}`);
  } catch (error: any) {
    // Package not installed or already uninstalled
    console.log(`   ⚠️  ${packageName} not installed or already removed`);
  }
}

/**
 * Install APK to instance
 */
async function installAPK(port: number, apkPath: string): Promise<void> {
  try {
    console.log(`   Installing ${path.basename(apkPath)}...`);

    const output = execSync(`"${ADB_PATH}" -s 127.0.0.1:${port} install -r "${apkPath}"`, {
      encoding: 'utf-8',
      timeout: 60000 // 60s timeout
    });

    if (output.includes('Success')) {
      console.log(`   ✅ Installed successfully`);
    } else {
      throw new Error(`Installation failed: ${output}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Failed to install: ${error.message}`);
    throw error;
  }
}

/**
 * Launch instance if not running
 */
async function ensureInstanceRunning(instance: LDInstance): Promise<void> {
  if (instance.status === 'running') {
    console.log(`   Instance already running (port ${instance.port})`);
    return;
  }

  console.log(`   Launching instance...`);
  execSync(`"${LDCONSOLE_PATH}" launch --index ${instance.index}`, { encoding: 'utf-8' });

  // Wait for boot
  console.log(`   Waiting for instance to boot...`);
  await new Promise(resolve => setTimeout(resolve, 15000)); // 15s

  // Enable ADB if not enabled
  try {
    execSync(`"${LDCONSOLE_PATH}" setprop --index ${instance.index} --key "adb.debug" --value "1"`, { encoding: 'utf-8' });
    execSync(`"${LDCONSOLE_PATH}" reboot --index ${instance.index}`, { encoding: 'utf-8' });
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for reboot
  } catch (err) {
    // ADB might already be enabled
  }
}

/**
 * Get package name from APK
 */
function getPackageName(apkPath: string): string {
  try {
    // Try to extract package name using aapt (if available)
    // For now, detect from filename
    const filename = path.basename(apkPath).toLowerCase();

    if (filename.includes('twitter')) {
      return 'com.twitter.android';
    } else if (filename.includes('facebook')) {
      return 'com.facebook.katana';
    } else if (filename.includes('instagram')) {
      return 'com.instagram.android';
    } else if (filename.includes('tiktok')) {
      return 'com.zhiliaoapp.musically';
    }

    // Default: ask user
    console.log('\n⚠️  Cannot detect package name from filename.');
    console.log('   Common package names:');
    console.log('   - com.twitter.android (Twitter)');
    console.log('   - com.facebook.katana (Facebook)');
    console.log('   - com.instagram.android (Instagram)');
    console.log('   - com.zhiliaoapp.musically (TikTok)');
    console.log('\n   Please enter package name manually or press Enter to skip uninstall:');

    return ''; // Will skip uninstall
  } catch (error) {
    return '';
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════╗
║       Install Modded APK to LDPlayer Instances        ║
╚════════════════════════════════════════════════════════╝

Usage:
  npx tsx scripts/install-modded-apk.ts <apk-path> [instance-name]

Examples:
  # Install to all running instances
  npx tsx scripts/install-modded-apk.ts ./apks/twitter-modded.apk

  # Install to specific instance
  npx tsx scripts/install-modded-apk.ts ./apks/twitter-modded.apk "worker_14"

  # Install to multiple instances
  npx tsx scripts/install-modded-apk.ts ./apks/twitter-modded.apk "worker_14,worker_15"

Notes:
  - APK will replace existing app (same package)
  - Instance will be launched automatically if stopped
  - Original app data will be preserved
    `);
    process.exit(0);
  }

  const apkPath = args[0];
  const targetInstanceName = args[1];

  // Validate APK file
  if (!fs.existsSync(apkPath)) {
    console.error(`❌ APK file not found: ${apkPath}`);
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       Install Modded APK to LDPlayer Instances        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📦 APK: ${path.basename(apkPath)}`);
  console.log(`📁 Path: ${path.resolve(apkPath)}\n`);

  // Get instances
  console.log('🔍 Finding LDPlayer instances...\n');
  const allInstances = getLDInstances();

  if (allInstances.length === 0) {
    console.error('❌ No LDPlayer instances found');
    process.exit(1);
  }

  // Filter instances
  let targetInstances: LDInstance[];

  if (targetInstanceName) {
    const names = targetInstanceName.split(',').map(n => n.trim());
    targetInstances = allInstances.filter(inst => names.includes(inst.name));

    if (targetInstances.length === 0) {
      console.error(`❌ Instance(s) not found: ${targetInstanceName}`);
      console.log('\nAvailable instances:');
      allInstances.forEach(inst => {
        console.log(`   - ${inst.name} (${inst.status})`);
      });
      process.exit(1);
    }
  } else {
    // Use all running instances
    targetInstances = allInstances.filter(inst => inst.status === 'running');

    if (targetInstances.length === 0) {
      console.error('❌ No running instances found. Please specify instance name or start instances first.');
      process.exit(1);
    }
  }

  console.log(`📱 Target instances: ${targetInstances.length}\n`);

  // Detect package name
  const packageName = getPackageName(apkPath);

  // Install to each instance
  let successCount = 0;
  let failCount = 0;

  for (const instance of targetInstances) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 Instance: ${instance.name} (Index ${instance.index})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      // Ensure instance is running
      await ensureInstanceRunning(instance);

      // Uninstall old version (if package name detected)
      if (packageName) {
        await uninstallPackage(instance.port, packageName);
      }

      // Install new APK
      await installAPK(instance.port, apkPath);

      console.log(`✅ ${instance.name}: Installation complete\n`);
      successCount++;

    } catch (error: any) {
      console.error(`❌ ${instance.name}: Installation failed - ${error.message}\n`);
      failCount++;
    }
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 INSTALLATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Success: ${successCount}/${targetInstances.length}`);
  console.log(`❌ Failed:  ${failCount}/${targetInstances.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (successCount === targetInstances.length) {
    console.log('🎉 All installations completed successfully!');
  } else if (successCount > 0) {
    console.log('⚠️  Some installations completed with errors. Check logs above.');
  } else {
    console.log('❌ All installations failed. Please check errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
