/**
 * Script: Tự động mở X (Twitter) trên nhiều instances
 * Tự động detect instances đang chạy và mở X
 */

import axios from 'axios';

const API_URL = 'http://localhost:5051';

async function autoOpenXOnAllInstances() {
  console.log('🚀 Auto-opening X on all running instances...\n');

  try {
    // Lấy tất cả profiles
    const response = await axios.get(`${API_URL}/api/profiles`);
    const profiles = response.data;

    console.log(`📋 Found ${profiles.length} total profiles\n`);

    // Lọc profiles đang active
    const activeProfiles = profiles.filter(p => p.status === 'active');

    if (activeProfiles.length === 0) {
      console.log('⚠️  No active instances found!');
      console.log('💡 Launch some instances first, then run this script.\n');
      return;
    }

    console.log(`✅ Found ${activeProfiles.length} active instances\n`);

    // Mở X trên tất cả instances đang chạy
    console.log('📱 Opening X on all active instances...\n');

    for (const profile of activeProfiles) {
      console.log(`🔄 ${profile.name} (Port: ${profile.port})`);

      try {
        // Execute script để mở X
        await axios.post(`${API_URL}/api/profiles/${profile.id}/execute-script`, {
          scriptType: 'custom',
          scriptName: 'open-x',
          scriptData: {
            adbCommands: [
              // Launch X app
              {
                type: 'shell',
                command: 'am start -n com.twitter.android/com.twitter.android.StartActivity'
              },
              // Wait for app to open
              { type: 'wait', duration: 2000 }
            ]
          }
        });

        console.log(`   ✅ X opened successfully\n`);

      } catch (error) {
        console.log(`   ❌ Failed: ${error.response?.data?.error || error.message}\n`);
      }
    }

    console.log('✨ Done! X is now open on all instances.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

// Run
autoOpenXOnAllInstances();
