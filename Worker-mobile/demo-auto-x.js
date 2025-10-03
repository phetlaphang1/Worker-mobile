/**
 * DEMO: Tự động launch instances và mở X
 * Chạy bao nhiêu instances tùy bạn!
 */

import axios from 'axios';
import readline from 'readline';

const API_URL = 'http://localhost:5051';

// Tạo interface để nhập số lượng instances
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function demoAutoX() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🚀 DEMO: Auto Launch + Open X        ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Hỏi số lượng instances muốn chạy
    const numInstancesStr = await ask('Bạn muốn chạy bao nhiêu instances? (1-5): ');
    const numInstances = parseInt(numInstancesStr) || 2;

    if (numInstances < 1 || numInstances > 5) {
      console.log('❌ Số lượng phải từ 1-5!');
      rl.close();
      return;
    }

    console.log(`\n✅ Sẽ chạy ${numInstances} instances\n`);

    // Step 1: Tạo profiles
    console.log(`📱 Step 1: Creating ${numInstances} profiles...\n`);
    const profiles = [];

    for (let i = 1; i <= numInstances; i++) {
      const response = await axios.post(`${API_URL}/api/profiles`, {
        name: `X Worker ${i}`,
        settings: {
          resolution: '720,1280',
          dpi: 240,
          cpu: 2,
          memory: 2048
        }
      });
      profiles.push(response.data.profile);
      console.log(`   ✅ Created: ${response.data.profile.name}`);
    }

    // Step 2: Launch tất cả instances (parallel)
    console.log(`\n🚀 Step 2: Launching ${numInstances} instances...`);
    console.log('   ⏳ Waiting for instances to boot (~60-90s)...\n');

    const launchPromises = profiles.map(async (profile) => {
      try {
        await axios.post(`${API_URL}/api/profiles/${profile.id}/activate`);
        console.log(`   ✅ ${profile.name} - Launched & X auto-installed!`);
        return { profile, success: true };
      } catch (error) {
        console.log(`   ❌ ${profile.name} - Launch failed`);
        return { profile, success: false };
      }
    });

    const results = await Promise.all(launchPromises);
    const successProfiles = results.filter(r => r.success).map(r => r.profile);

    if (successProfiles.length === 0) {
      console.log('\n❌ No instances launched successfully!');
      rl.close();
      return;
    }

    console.log(`\n✅ ${successProfiles.length}/${numInstances} instances launched successfully!\n`);

    // Step 3: Mở X trên tất cả instances
    console.log('📱 Step 3: Opening X on all instances...\n');

    for (const profile of successProfiles) {
      try {
        await axios.post(`${API_URL}/api/profiles/${profile.id}/execute-script`, {
          scriptType: 'custom',
          scriptName: 'open-x',
          scriptData: {
            adbCommands: [
              {
                type: 'shell',
                command: 'am start -n com.twitter.android/com.twitter.android.StartActivity'
              },
              { type: 'wait', duration: 2000 }
            ]
          }
        });
        console.log(`   ✅ X opened on ${profile.name}`);
      } catch (error) {
        console.log(`   ⚠️  Failed to open X on ${profile.name}`);
      }
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✨ DEMO COMPLETED!                   ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  ${successProfiles.length} instances running with X open    ║`);
    console.log('╚════════════════════════════════════════╝\n');

    console.log('💡 Bạn có thể thấy các LDPlayer windows với X đang mở!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  } finally {
    rl.close();
  }
}

demoAutoX();
