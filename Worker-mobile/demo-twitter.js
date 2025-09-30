// Demo Twitter automation
import axios from 'axios';

const API_URL = 'http://localhost:5052';

async function demoTwitter() {
  try {
    console.log('🐦 Twitter Mobile Automation Demo');
    console.log('==================================\n');

    // Step 1: Create profile
    console.log('📱 Creating profile for Twitter...');
    const profileRes = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Twitter Demo Profile',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 3072
      },
      device: {
        model: 'Pixel 4',
        manufacturer: 'Google',
        brand: 'google'
      }
    });

    const profile = profileRes.data.profile;
    console.log(`✅ Profile created: ${profile.name}`);

    // Step 2: Activate profile (launch LDPlayer)
    console.log('\n🚀 Launching LDPlayer instance...');
    await axios.post(`${API_URL}/api/profiles/${profile.id}/activate`);
    console.log('✅ LDPlayer launched!');
    console.log('⏳ Waiting for instance to be ready (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Step 3: Create Twitter task
    console.log('\n📝 Creating Twitter task...');
    const taskRes = await axios.post(`${API_URL}/api/tasks`, {
      type: 'twitter_post',
      profileId: profile.id,
      data: {
        text: 'Hello from Worker Mobile! 🤖 #Automation',
        username: 'your_twitter_username',  // Change this
        password: 'your_twitter_password'   // Change this
      },
      priority: 10
    });

    console.log(`✅ Task created: ${taskRes.data.task.id}`);
    console.log('⏳ Task will be executed automatically...');

    // Step 4: Monitor task status
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const tasksRes = await axios.get(`${API_URL}/api/tasks`);
      const task = tasksRes.data.tasks.find(t => t.id === taskRes.data.task.id);

      console.log(`📊 Task status: ${task.status}`);

      if (task.status === 'completed') {
        console.log('✅ Task completed successfully!');
        console.log('Result:', task.result);
        break;
      } else if (task.status === 'failed') {
        console.log('❌ Task failed:', task.error);
        break;
      }

      attempts++;
    }

    console.log('\n✨ Demo completed!');
    console.log('💡 Check LDPlayer window to see Twitter app running');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Instructions
console.log('⚠️  IMPORTANT: Before running this demo:');
console.log('1. Make sure server is running (npm run dev)');
console.log('2. Install Twitter app APK in LDPlayer (if needed)');
console.log('3. Update username/password in this script');
console.log('4. Press Enter to continue...\n');

process.stdin.once('data', () => {
  demoTwitter();
});