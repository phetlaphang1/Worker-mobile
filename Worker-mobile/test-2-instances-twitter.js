/**
 * Test Script: Launch 2 instances và tự động mở Twitter
 */

import axios from 'axios';

const API_URL = 'http://localhost:5051';

async function test2InstancesWithTwitter() {
  console.log('🚀 Starting test: 2 instances + Twitter auto-open\n');

  try {
    // Step 1: Tạo 2 profiles
    console.log('📱 Step 1: Creating 2 profiles...\n');

    const profile1Response = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Twitter Worker 1',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      }
    });
    const profile1 = profile1Response.data.profile;
    console.log(`✅ Created: ${profile1.name} (ID: ${profile1.id}, Port: ${profile1.port})\n`);

    const profile2Response = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Twitter Worker 2',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      }
    });
    const profile2 = profile2Response.data.profile;
    console.log(`✅ Created: ${profile2.name} (ID: ${profile2.id}, Port: ${profile2.port})\n`);

    // Step 2: Launch cả 2 instances (parallel)
    console.log('🚀 Step 2: Launching 2 instances...');
    console.log('   ⏳ This will take ~60-90 seconds (instances need to boot)\n');

    const launchPromises = [
      axios.post(`${API_URL}/api/profiles/${profile1.id}/activate`).then(() => {
        console.log(`✅ ${profile1.name} launched and Twitter auto-installed!`);
      }),
      axios.post(`${API_URL}/api/profiles/${profile2.id}/activate`).then(() => {
        console.log(`✅ ${profile2.name} launched and Twitter auto-installed!`);
      })
    ];

    await Promise.all(launchPromises);

    console.log('\n🎉 Both instances are ready!\n');

    // Step 3: Mở Twitter trên cả 2 instances
    console.log('📱 Step 3: Opening Twitter on both instances...\n');

    await axios.post(`${API_URL}/api/profiles/${profile1.id}/execute-script`, {
      scriptType: 'custom',
      scriptName: 'open-twitter',
      scriptData: {
        adbCommands: [
          { type: 'shell', command: 'am start -n com.twitter.android/.StartActivity' },
          { type: 'wait', duration: 3000 }
        ]
      }
    });
    console.log(`✅ Twitter opened on ${profile1.name}`);

    await axios.post(`${API_URL}/api/profiles/${profile2.id}/execute-script`, {
      scriptType: 'custom',
      scriptName: 'open-twitter',
      scriptData: {
        adbCommands: [
          { type: 'shell', command: 'am start -n com.twitter.android/.StartActivity' },
          { type: 'wait', duration: 3000 }
        ]
      }
    });
    console.log(`✅ Twitter opened on ${profile2.name}`);

    console.log('\n✨ Test completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - ${profile1.name}: Running with Twitter open`);
    console.log(`   - ${profile2.name}: Running with Twitter open`);
    console.log('\n💡 You can now see 2 LDPlayer windows with Twitter running!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
test2InstancesWithTwitter();
