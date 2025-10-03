/**
 * Test BoxPhone-like System on LDPlayer
 * Chạy nhiều instances và execute scripts giống như browser automation
 */

import axios from 'axios';

const API_URL = 'http://localhost:5051';

async function testBoxPhoneSystem() {
  try {
    console.log('🚀 Testing BoxPhone-like System on LDPlayer\n');

    // Step 1: Tạo 2 profiles
    console.log('📱 Step 1: Creating 2 profiles...');

    const profile1 = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Mobile Worker 1',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      }
    });
    console.log(`✅ Created: ${profile1.data.profile.name} (ID: ${profile1.data.profile.id})`);

    const profile2 = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Mobile Worker 2',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      }
    });
    console.log(`✅ Created: ${profile2.data.profile.name} (ID: ${profile2.data.profile.id})`);

    // Step 2: Activate profiles (launch LDPlayer instances)
    console.log('\n🚀 Step 2: Launching LDPlayer instances...');
    console.log('   This will take ~30 seconds...\n');

    await axios.post(`${API_URL}/api/profiles/${profile1.data.profile.id}/activate`);
    console.log(`✅ ${profile1.data.profile.name} launched!`);

    await axios.post(`${API_URL}/api/profiles/${profile2.data.profile.id}/activate`);
    console.log(`✅ ${profile2.data.profile.name} launched!`);

    // Step 3: Execute scripts (giống như chạy scripts trên browser)
    console.log('\n📝 Step 3: Executing scripts on both profiles...\n');

    // Profile 1: Like tweets about "blockchain"
    const script1 = await axios.post(
      `${API_URL}/api/profiles/${profile1.data.profile.id}/execute-script`,
      {
        scriptType: 'twitter',
        scriptName: 'likeTweets',
        scriptData: {
          searchQuery: 'blockchain',
          count: 3
        }
      }
    );
    console.log(`✅ Script queued for ${profile1.data.profile.name}: Like 3 tweets about "blockchain"`);

    // Profile 2: Post a tweet
    const script2 = await axios.post(
      `${API_URL}/api/profiles/${profile2.data.profile.id}/execute-script`,
      {
        scriptType: 'twitter',
        scriptName: 'postTweet',
        scriptData: {
          text: 'Hello from Mobile Worker! 🤖 #Automation'
        }
      }
    );
    console.log(`✅ Script queued for ${profile2.data.profile.name}: Post tweet`);

    // Step 4: Monitor execution
    console.log('\n📊 Step 4: Monitoring script execution...\n');

    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const scriptsRes = await axios.get(`${API_URL}/api/scripts`);
      const scripts = scriptsRes.data;

      const running = scripts.filter(s => s.status === 'running').length;
      const completed = scripts.filter(s => s.status === 'completed').length;
      const failed = scripts.filter(s => s.status === 'failed').length;
      const pending = scripts.filter(s => s.status === 'pending').length;

      process.stdout.write(`\r   Running: ${running} | Completed: ${completed} | Failed: ${failed} | Pending: ${pending}   `);

      if (running === 0 && pending === 0 && scripts.length > 0) {
        console.log('\n\n✅ All scripts completed!');
        break;
      }

      attempts++;
    }

    // Step 5: Show results
    console.log('\n📊 Results:\n');
    const scriptsRes = await axios.get(`${API_URL}/api/scripts`);

    for (const script of scriptsRes.data) {
      console.log(`   Script ${script.id}:`);
      console.log(`   - Type: ${script.scriptType}/${script.scriptName}`);
      console.log(`   - Status: ${script.status}`);
      if (script.result) {
        console.log(`   - Result:`, script.result);
      }
      if (script.error) {
        console.log(`   - Error: ${script.error}`);
      }
      console.log();
    }

    // Step 6: Cleanup
    console.log('🧹 Step 6: Cleaning up...\n');

    await axios.post(`${API_URL}/api/profiles/${profile1.data.profile.id}/deactivate`);
    console.log(`✅ ${profile1.data.profile.name} stopped`);

    await axios.post(`${API_URL}/api/profiles/${profile2.data.profile.id}/deactivate`);
    console.log(`✅ ${profile2.data.profile.name} stopped`);

    console.log('\n✨ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

// Instructions
console.log('┌────────────────────────────────────────────────────────┐');
console.log('│  🎯 BoxPhone-like System Test                         │');
console.log('├────────────────────────────────────────────────────────┤');
console.log('│  This will:                                            │');
console.log('│  1. Create 2 profiles                                  │');
console.log('│  2. Launch 2 LDPlayer instances                        │');
console.log('│  3. Execute scripts on both (like browser automation)  │');
console.log('│  4. Show results                                       │');
console.log('│  5. Clean up                                           │');
console.log('├────────────────────────────────────────────────────────┤');
console.log('│  Make sure:                                            │');
console.log('│  - Server is running (npm run dev)                     │');
console.log('│  - LDPlayer is installed                               │');
console.log('│  - LDCONSOLE_PATH set in .env                          │');
console.log('└────────────────────────────────────────────────────────┘');
console.log();
console.log('Press Enter to start or Ctrl+C to cancel...');

process.stdin.once('data', () => {
  testBoxPhoneSystem();
});
