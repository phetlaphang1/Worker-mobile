import fs from 'fs/promises';
import path from 'path';
import { FingerprintGenerator } from '../server/services/FingerprintGenerator.js';

/**
 * Migration Script: Add resolution and dpi to existing profiles
 *
 * This script updates all existing profiles to include device.resolution and device.dpi
 * based on their device fingerprint (brand/model match with real device templates)
 */

interface Profile {
  id: number;
  name: string;
  instanceName: string;
  device?: {
    brand?: string;
    model?: string;
    resolution?: string;
    dpi?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

async function migrateProfiles() {
  const profilesDir = path.join(process.cwd(), 'data', 'profiles');

  console.log('🔄 Starting profile migration...');
  console.log(`📂 Profiles directory: ${profilesDir}`);

  try {
    // Read all profile files
    const files = await fs.readdir(profilesDir);
    const profileFiles = files.filter(f => f.endsWith('.json') && /^\d+\.json$/.test(f));

    console.log(`📋 Found ${profileFiles.length} profiles to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of profileFiles) {
      const profilePath = path.join(profilesDir, file);

      try {
        // Read profile
        const data = await fs.readFile(profilePath, 'utf-8');
        const profile: Profile = JSON.parse(data);

        console.log(`\n📄 Processing Profile #${profile.id}: ${profile.name}`);

        // Check if already has resolution
        if (profile.device?.resolution) {
          console.log(`  ✅ Already has resolution: ${profile.device.resolution}`);
          skippedCount++;
          continue;
        }

        // Get device info
        const brand = profile.device?.brand;
        const model = profile.device?.model;

        if (!brand || !model) {
          console.log(`  ⚠️  No device fingerprint found (brand: ${brand}, model: ${model})`);
          console.log(`  🔧 Assigning default Samsung device...`);

          // Assign default Samsung device
          const templates = FingerprintGenerator.getAllDeviceTemplates();
          const defaultTemplate = templates.find(t => t.brand === 'Samsung' && t.model === 'SM-A525F');

          if (defaultTemplate) {
            profile.device = profile.device || {};
            profile.device.resolution = defaultTemplate.resolution;
            profile.device.dpi = defaultTemplate.dpi;

            console.log(`  ✅ Assigned default: ${defaultTemplate.model} (${defaultTemplate.resolution} @ ${defaultTemplate.dpi}dpi)`);
          }
        } else {
          // Find matching template by brand and model
          const templates = FingerprintGenerator.getAllDeviceTemplates();
          const matchingTemplate = templates.find(t =>
            t.brand === brand && t.model === model
          );

          if (matchingTemplate) {
            // Update profile with resolution from template
            profile.device.resolution = matchingTemplate.resolution;
            profile.device.dpi = matchingTemplate.dpi;

            console.log(`  ✅ Matched template: ${matchingTemplate.brand} ${matchingTemplate.model}`);
            console.log(`     Resolution: ${matchingTemplate.resolution} @ ${matchingTemplate.dpi}dpi`);
          } else {
            // No exact match - use brand-based template
            console.log(`  ⚠️  No exact match for ${brand} ${model}`);

            const brandTemplate = templates.find(t => t.brand === brand);
            if (brandTemplate) {
              profile.device.resolution = brandTemplate.resolution;
              profile.device.dpi = brandTemplate.dpi;

              console.log(`  🔧 Using brand fallback: ${brandTemplate.brand} ${brandTemplate.model}`);
              console.log(`     Resolution: ${brandTemplate.resolution} @ ${brandTemplate.dpi}dpi`);
            } else {
              // Ultimate fallback - Samsung A52
              const fallbackTemplate = templates.find(t => t.model === 'SM-A525F');
              if (fallbackTemplate) {
                profile.device.resolution = fallbackTemplate.resolution;
                profile.device.dpi = fallbackTemplate.dpi;

                console.log(`  🔧 Using fallback: ${fallbackTemplate.model} (${fallbackTemplate.resolution})`);
              }
            }
          }
        }

        // Save updated profile
        await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
        console.log(`  💾 Profile saved with resolution: ${profile.device?.resolution}`);
        migratedCount++;

      } catch (error) {
        console.error(`  ❌ Error processing ${file}:`, error);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} profiles`);
    console.log(`   ⏭️  Skipped: ${skippedCount} profiles (already have resolution)`);
    console.log(`   ❌ Errors: ${errorCount} profiles`);
    console.log(`   📋 Total: ${profileFiles.length} profiles`);
    console.log('='.repeat(60));

    if (migratedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Tip: Restart the server to load updated profiles.');
    } else {
      console.log('\n✨ All profiles already up to date!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateProfiles()
  .then(() => {
    console.log('\n✅ Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
