/**
 * Import tất cả LDPlayer instances hiện có vào hệ thống Profile
 * Chạy: npx tsx import-instances.ts
 */

import LDPlayerController from './server/core/LDPlayerController.js';
import ProfileManager from './server/services/ProfileManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function importInstances() {
  const controller = new LDPlayerController();
  const profileManager = new ProfileManager(controller);

  try {
    console.log('\n=== IMPORT LDPLAYER INSTANCES VÀO HỆ THỐNG ===\n');

    // Step 1: Scan tất cả instances
    console.log('📱 Bước 1: Scan tất cả LDPlayer instances...');
    const instances = await controller.getAllInstancesFromLDConsole();

    console.log(`✅ Tìm thấy ${instances.length} instances:\n`);
    instances.forEach(inst => {
      console.log(`   - ${inst.name} (index: ${inst.index}, port: ${inst.port})`);
    });
    console.log();

    // Step 2: Import vào hệ thống
    console.log('📥 Bước 2: Import instances vào hệ thống Profile...');
    const profiles = await profileManager.scanAndImportAllInstances();

    console.log(`✅ Đã import ${profiles.length} profiles:\n`);
    profiles.forEach(profile => {
      console.log(`   - ${profile.name} (ID: ${profile.id})`);
      console.log(`     Instance: ${profile.instanceName}`);
      console.log(`     Port: ${profile.port}`);
      console.log(`     Status: ${profile.status}\n`);
    });

    console.log('🎉 === HOÀN TẤT ===');
    console.log('\nCác instances đã được import vào hệ thống.');
    console.log('Bạn có thể quản lý chúng qua:');
    console.log('  - Web UI: http://localhost:5173 → Tab Profiles');
    console.log('  - API: GET http://localhost:5051/api/profiles');
    console.log('\nĐể launch profile:');
    console.log('  POST /api/profiles/:profileId/activate');

  } catch (error) {
    console.error('\n❌ LỖI:', error);
    throw error;
  }
}

// Run import
importInstances().catch(console.error);
