// Test script để demo LDPlayer automation
import axios from 'axios';

const API_URL = 'http://localhost:5052';

async function testLDPlayer() {
  try {
    console.log('🔍 Checking server health...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Server is running:', health.data);

    console.log('\n📱 Creating a new profile...');
    const profileResponse = await axios.post(`${API_URL}/api/profiles`, {
      name: 'Test Profile 1',
      settings: {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048
      }
    });

    const profile = profileResponse.data.profile;
    console.log('✅ Profile created:', profile.name, `(ID: ${profile.id})`);

    console.log('\n🚀 Activating profile (launching LDPlayer instance)...');
    console.log('⏳ This will open LDPlayer window...');

    await axios.post(`${API_URL}/api/profiles/${profile.id}/activate`);
    console.log('✅ LDPlayer instance launched!');

    // Wait a bit for instance to fully load
    console.log('\n⏳ Waiting for instance to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n📱 Taking a screenshot...');
    await axios.post(`${API_URL}/api/device/${profile.port}/screenshot`, {
      savePath: `./screenshots/test_${Date.now()}.png`
    });
    console.log('✅ Screenshot saved');

    console.log('\n👆 Performing tap at center of screen...');
    await axios.post(`${API_URL}/api/device/${profile.port}/tap`, {
      x: 360,
      y: 640
    });
    console.log('✅ Tap performed');

    console.log('\n👆 Performing swipe (scroll down)...');
    await axios.post(`${API_URL}/api/device/${profile.port}/swipe`, {
      x1: 360,
      y1: 800,
      x2: 360,
      y2: 400,
      duration: 500
    });
    console.log('✅ Swipe performed');

    console.log('\n✍️ Typing text...');
    await axios.post(`${API_URL}/api/device/${profile.port}/text`, {
      text: 'Hello from Worker Mobile!'
    });
    console.log('✅ Text typed');

    console.log('\n📊 Getting statistics...');
    const stats = await axios.get(`${API_URL}/api/statistics`);
    console.log('📈 Current stats:', stats.data);

    console.log('\n✅ Test completed successfully!');
    console.log('💡 LDPlayer instance is still running. You can interact with it manually.');
    console.log('💡 To stop the instance, press Ctrl+C or close LDPlayer window.');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the test
testLDPlayer();