/**
 * Script to apply random fingerprints to all existing profiles
 * This will generate and apply unique fingerprints to each instance
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import LDPlayerController from '../server/core/LDPlayerController.js';
import FingerprintService from '../server/services/FingerprintService.js';
import { FingerprintGenerator } from '../server/services/FingerprintGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Profile {
  id: number;
  name: string;
  instanceName: string;
  device?: {
    imei?: string;
    androidId?: string;
    model?: string;
    manufacturer?: string;
    brand?: string;
  };
  status: string;
}

async function applyFingerprintsToExistingProfiles() {
  console.log('🚀 Starting fingerprint application to existing profiles...\n');

  const ldController = new LDPlayerController();
  const fingerprintService = new FingerprintService(ldController);

  // Load all instances from LDPlayer
  await ldController.getAllInstancesFromLDConsole();
  console.log('✅ LDPlayer instances loaded\n');

  // Read all profiles
  const profilesPath = path.join(process.cwd(), 'data', 'profiles');
  const files = await fs.readdir(profilesPath);
  const profileFiles = files.filter(f => f.endsWith('.json') && /^\d+\.json$/.test(f));

  console.log(`📋 Found ${profileFiles.length} profiles to process\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const file of profileFiles) {
    const profilePath = path.join(profilesPath, file);
    const data = await fs.readFile(profilePath, 'utf-8');
    const profile: Profile = JSON.parse(data);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 Processing Profile #${profile.id}: ${profile.name}`);
    console.log(`   Instance: ${profile.instanceName}`);
    console.log(`   Status: ${profile.status}`);

    // Check if profile already has fingerprint
    if (profile.device?.imei && profile.device?.androidId) {
      console.log(`   ⏭️  SKIP - Already has fingerprint:`);
      console.log(`      IMEI: ${profile.device.imei}`);
      console.log(`      Android ID: ${profile.device.androidId}`);
      console.log(`      Device: ${profile.device.brand} ${profile.device.model}`);
      skipCount++;
      continue;
    }

    try {
      // Generate random fingerprint
      const fingerprint = FingerprintGenerator.generateFingerprint({
        includePhoneNumber: true
      });

      console.log(`   🎲 Generated fingerprint:`);
      console.log(`      Brand: ${fingerprint.brand}`);
      console.log(`      Model: ${fingerprint.model}`);
      console.log(`      IMEI: ${fingerprint.imei}`);
      console.log(`      Android ID: ${fingerprint.androidId}`);

      // Check if instance is running
      const instance = ldController.getInstance(profile.instanceName);
      if (!instance) {
        console.log(`   ⚠️  WARNING - Instance not found in LDPlayer`);
        failCount++;
        continue;
      }

      const wasRunning = profile.status === 'active';
      if (wasRunning) {
        console.log(`   ⏸️  Instance is running, stopping first...`);
        await ldController.stopInstance(profile.instanceName);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Apply fingerprint via ldconsole (instance must be stopped)
      console.log(`   ⚙️  Applying fingerprint via ldconsole...`);
      await fingerprintService.applyFingerprint(
        profile.instanceName,
        fingerprint,
        {
          method: 'ldconsole',
          requireRestart: false
        }
      );

      // Update profile JSON
      profile.device = {
        imei: fingerprint.imei,
        androidId: fingerprint.androidId,
        model: fingerprint.model,
        manufacturer: fingerprint.manufacturer,
        brand: fingerprint.brand
      };

      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
      console.log(`   💾 Profile JSON updated`);

      // Restart if it was running
      if (wasRunning) {
        console.log(`   ▶️  Restarting instance...`);
        await ldController.launchInstance(profile.instanceName);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`   ✅ SUCCESS - Fingerprint applied successfully!`);
      successCount++;

    } catch (error) {
      console.log(`   ❌ FAILED - Error: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped (already has fingerprint): ${skipCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📋 Total: ${profileFiles.length}`);
  console.log(`\n✨ Done!\n`);
}

// Run the script
applyFingerprintsToExistingProfiles()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
