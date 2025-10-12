/**
 * Sync Resolution from Profile JSON to LDPlayer Instances
 * Đọc resolution trong profile JSON và apply vào LDPlayer
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LDCONSOLE_PATH = 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
const PROFILES_DIR = 'D:\\BArmy\\Worker-mobile\\data\\profiles';

interface Profile {
  id: number;
  name: string;
  instanceName: string;
  settings?: {
    resolution?: string;
    cpu?: number;
    memory?: number;
  };
}

interface LDInstance {
  index: number;
  name: string;
  isRunning: boolean;
  currentResolution: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllProfiles(): Profile[] {
  const files = fs.readdirSync(PROFILES_DIR);
  const profiles: Profile[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(PROFILES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const profile = JSON.parse(content);

    profiles.push(profile);
  }

  return profiles;
}

function getAllLDInstances(): LDInstance[] {
  const result = execSync(`"${LDCONSOLE_PATH}" list2`).toString();
  const lines = result.trim().split('\n');

  let runningResult = '';
  try {
    runningResult = execSync(`"${LDCONSOLE_PATH}" runninglist`).toString();
  } catch (error) {
    // No running instances
  }
  const runningNames = runningResult.trim().split('\n').filter((n: string) => n.length > 0);

  const instances: LDInstance[] = [];

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 9) continue;

    const index = parseInt(parts[0], 10);
    const name = parts[1];
    const width = parts[7];
    const height = parts[8];

    // Skip invalid instances
    if (!name || name.includes('NaN') || name === '111') continue;

    const isRunning = runningNames.includes(name);

    instances.push({
      index,
      name,
      isRunning,
      currentResolution: `${width}x${height}`
    });
  }

  return instances;
}

function parseResolution(resolutionStr?: string): { width: number; height: number; dpi: number } | null {
  if (!resolutionStr) return null;

  // Format: "360,640" or "360,640,240"
  const parts = resolutionStr.split(',').map(p => parseInt(p.trim(), 10));

  if (parts.length < 2) return null;

  return {
    width: parts[0],
    height: parts[1],
    dpi: parts[2] || 240 // Default DPI
  };
}

async function applyResolution(instanceIndex: number, instanceName: string, resolution: { width: number; height: number; dpi: number }, isRunning: boolean): Promise<boolean> {
  try {
    console.log(`  🔧 Applying ${resolution.width}x${resolution.height} to ${instanceName}...`);

    // Apply resolution
    execSync(`"${LDCONSOLE_PATH}" modify --index ${instanceIndex} --resolution ${resolution.width},${resolution.height},${resolution.dpi}`, {
      stdio: 'ignore'
    });

    console.log(`  ✅ Resolution applied`);

    // Reboot if running to apply changes
    if (isRunning) {
      console.log(`  🔄 Rebooting ${instanceName} to apply changes...`);
      execSync(`"${LDCONSOLE_PATH}" reboot --index ${instanceIndex}`, {
        stdio: 'ignore'
      });
      console.log(`  ⏳ Waiting 30 seconds for reboot...`);
      await sleep(30000);
      console.log(`  ✅ ${instanceName} rebooted`);
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Failed to apply resolution: ${error}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔄 Resolution Sync Script');
  console.log('Sync resolution from Profile JSON → LDPlayer');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get all profiles
    const profiles = getAllProfiles();
    console.log(`📋 Found ${profiles.length} profiles\n`);

    // Get all LDPlayer instances
    const ldInstances = getAllLDInstances();
    console.log(`🖥️  Found ${ldInstances.length} LDPlayer instances\n`);

    const updates: Array<{
      profile: Profile;
      instance: LDInstance;
      targetResolution: { width: number; height: number; dpi: number };
    }> = [];

    // Match profiles with instances
    for (const profile of profiles) {
      const instance = ldInstances.find(ld => ld.name === profile.instanceName);

      if (!instance) {
        console.log(`⚠️  Profile "${profile.name}" → Instance "${profile.instanceName}" not found in LDPlayer`);
        continue;
      }

      // Parse target resolution from profile
      const targetResolution = parseResolution(profile.settings?.resolution);

      if (!targetResolution) {
        console.log(`⚠️  Profile "${profile.name}" has no valid resolution setting, skipping...`);
        continue;
      }

      // Check if resolution matches
      const currentRes = instance.currentResolution.replace('x', ',').replace(',240', '');
      const targetRes = `${targetResolution.width},${targetResolution.height}`;

      if (currentRes === targetRes) {
        console.log(`✅ Profile "${profile.name}" → Instance "${instance.name}" already has correct resolution (${currentRes})`);
        continue;
      }

      console.log(`🔍 Profile "${profile.name}" → Instance "${instance.name}"`);
      console.log(`   Current: ${instance.currentResolution}`);
      console.log(`   Target:  ${targetResolution.width}x${targetResolution.height}`);
      console.log(`   Status:  ${instance.isRunning ? '🟢 Running' : '⚪ Stopped'}`);

      updates.push({
        profile,
        instance,
        targetResolution
      });
    }

    if (updates.length === 0) {
      console.log('\n✅ All instances already have correct resolution!');
      return;
    }

    console.log(`\n🎯 Will update ${updates.length} instances:\n`);
    updates.forEach(u => {
      console.log(`  • ${u.instance.name} → ${u.targetResolution.width}x${u.targetResolution.height}`);
    });

    console.log('\n⏳ Starting updates...\n');

    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      console.log(`\n📱 Updating: ${update.instance.name}`);
      const success = await applyResolution(
        update.instance.index,
        update.instance.name,
        update.targetResolution,
        update.instance.isRunning
      );

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Wait between updates
      if (updates.indexOf(update) < updates.length - 1) {
        await sleep(2000);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 SYNC SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`✅ Success: ${successCount}/${updates.length}`);
    console.log(`❌ Failed: ${failCount}/${updates.length}`);

    if (failCount === 0) {
      console.log('\n🎉 All resolutions synced successfully!');
      console.log('💡 Tip: Restart server to reconnect ADB');
      console.log('   npm run pm2:restart');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
