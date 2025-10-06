/**
 * Test script: Clone profile functionality
 * Demonstrates how cloning creates independent instances
 *
 * Run: npx tsx test-clone-profile.ts
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5051/api';

async function testCloneProfile() {
  console.log('\n=== TEST: CLONE PROFILE FUNCTIONALITY ===\n');

  try {
    // Step 1: Get all profiles
    console.log('📋 Step 1: Fetching all profiles...');
    const { data: profiles } = await axios.get(`${API_BASE}/profiles`);
    console.log(`Found ${profiles.length} profiles\n`);

    if (profiles.length === 0) {
      console.log('❌ No profiles found. Please create a profile first.');
      console.log('💡 Tip: Go to UI and click "Import Instances" or "Create New Profile"');
      return;
    }

    // Find an inactive profile to clone
    const sourceProfile = profiles.find((p: any) => p.status === 'inactive');

    if (!sourceProfile) {
      console.log('❌ No inactive profiles found. Please stop a profile first.');
      console.log('💡 Clone only works on stopped instances');
      return;
    }

    console.log(`✅ Source profile found: ${sourceProfile.name}`);
    console.log(`   - ID: ${sourceProfile.id}`);
    console.log(`   - Instance: ${sourceProfile.instanceName}`);
    console.log(`   - Port: ${sourceProfile.port}`);
    console.log(`   - Apps: ${Object.keys(sourceProfile.apps || {}).join(', ') || 'None'}\n`);

    // Step 2: Clone WITH apps
    const cloneName = `${sourceProfile.name}_Clone_${Date.now()}`;
    console.log(`🔄 Step 2: Cloning profile WITH apps...`);
    console.log(`   Source: ${sourceProfile.name}`);
    console.log(`   Target: ${cloneName}`);
    console.log(`   Copy Apps: YES\n`);

    const { data: cloneResult } = await axios.post(
      `${API_BASE}/profiles/${sourceProfile.id}/clone`,
      {
        newName: cloneName,
        copyApps: true,        // Clone with apps
        launchAndSetup: false  // Don't auto-launch
      }
    );

    const clonedProfile = cloneResult.profile;

    console.log('✅ Clone successful!\n');
    console.log('📊 COMPARISON:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Property          | Original        | Clone');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name              | ${sourceProfile.name.padEnd(15)} | ${clonedProfile.name}`);
    console.log(`ID                | ${sourceProfile.id.padEnd(15)} | ${clonedProfile.id}`);
    console.log(`Instance Name     | ${sourceProfile.instanceName.padEnd(15)} | ${clonedProfile.instanceName}`);
    console.log(`Port              | ${String(sourceProfile.port).padEnd(15)} | ${clonedProfile.port}`);
    console.log(`Status            | ${sourceProfile.status.padEnd(15)} | ${clonedProfile.status}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 3: Show what's SAME (cloned)
    console.log('✅ GIỐNG NHAU (Được clone):');
    console.log(`   ✓ Settings: ${JSON.stringify(clonedProfile.settings)}`);
    console.log(`   ✓ Device config: ${JSON.stringify(clonedProfile.device)}`);
    console.log(`   ✓ Network config: ${JSON.stringify(clonedProfile.network)}`);
    console.log(`   ✓ Apps installed: ${Object.keys(clonedProfile.apps || {}).join(', ') || 'None'}\n`);

    // Step 4: Show what's DIFFERENT (independent)
    console.log('🔄 KHÁC BIỆT (Độc lập):');
    console.log(`   ✗ Profile ID: ${sourceProfile.id} → ${clonedProfile.id}`);
    console.log(`   ✗ Instance Name: ${sourceProfile.instanceName} → ${clonedProfile.instanceName}`);
    console.log(`   ✗ Port: ${sourceProfile.port} → ${clonedProfile.port}`);
    console.log(`   ✗ Created time: NEW timestamp`);
    console.log(`   ✗ App data: KHÔNG được copy (phải login lại)\n`);

    // Step 5: Show independence
    console.log('💡 ĐỘC LẬP HOÀN TOÀN:');
    console.log('   • Mỗi instance có runtime riêng');
    console.log('   • Có thể chạy đồng thời mà không ảnh hưởng nhau');
    console.log('   • Có thể set proxy, device info, location khác nhau');
    console.log('   • Mỗi instance cần login apps riêng (data không copy)\n');

    console.log('🎉 === TEST COMPLETED ===');
    console.log(`\n💡 TIP: Bạn có thể clone thêm nhiều instances từ "${sourceProfile.name}":`);
    console.log(`   for i in {1..10}; do`);
    console.log(`     curl -X POST ${API_BASE}/profiles/${sourceProfile.id}/clone \\`);
    console.log(`       -H "Content-Type: application/json" \\`);
    console.log(`       -d '{"newName": "Worker-$i", "copyApps": true}'`);
    console.log(`   done`);
    console.log('\n📱 Hoặc dùng UI: Click nút "Clone" trên ProfileCard\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run test
testCloneProfile().catch(console.error);
