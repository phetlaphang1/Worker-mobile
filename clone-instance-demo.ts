/**
 * Demo: Clone LDPlayer instance với X đã cài sẵn
 * Chạy: npx tsx clone-instance-demo.ts
 */

import LDPlayerController from './server/core/LDPlayerController.js';
import dotenv from 'dotenv';

dotenv.config();

async function cloneInstanceDemo() {
  const controller = new LDPlayerController();

  try {
    console.log('\n=== DEMO: CLONE LDPLAYER INSTANCE ===\n');

    // Instance nguồn (đã cài X thành công - instance index 0)
    const sourceInstanceName = 'LDPlayer'; // Instance #0 đã có X
    const targetInstanceName = 'X-Worker-Clone-1';

    console.log(`📱 Instance nguồn: ${sourceInstanceName}`);
    console.log(`📱 Instance đích: ${targetInstanceName}\n`);

    // Step 1: Clone instance
    console.log('🔄 Bước 1: Clone instance (bao gồm tất cả apps đã cài)...');
    const clonedInstance = await controller.cloneInstance(sourceInstanceName, targetInstanceName);

    console.log(`✅ Instance đã clone thành công!`);
    console.log(`   - Tên: ${clonedInstance.name}`);
    console.log(`   - Index: ${clonedInstance.index}`);
    console.log(`   - Port: ${clonedInstance.port}\n`);

    // Step 2: Launch cloned instance
    console.log('🚀 Bước 2: Khởi động instance clone...');
    await controller.launchInstance(targetInstanceName);
    console.log('✅ Instance clone đã khởi động\n');

    // Wait for boot
    console.log('⏳ Đợi instance boot xong (20s)...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    console.log('✅ Instance đã sẵn sàng\n');

    // Step 3: Launch X app
    console.log('🎯 Bước 3: Khởi chạy X app...');
    await controller.launchAppViaLDConsole(clonedInstance.index, 'com.twitter.android');
    console.log('✅ X app đã được khởi chạy!\n');

    console.log('🎉 === HOÀN TẤT ===');
    console.log('\nInstance clone đang chạy với X app.');
    console.log('Bạn có thể kiểm tra trực tiếp trên LDPlayer.');
    console.log('\nĐể dừng instance, chạy:');
    console.log(`"${process.env.LDCONSOLE_PATH}" quit --name "${targetInstanceName}"`);

    console.log('\n💡 TIP: Bạn có thể clone nhiều instances cùng lúc để scale!');
    console.log('Mỗi instance clone sẽ có X app đã cài sẵn từ instance gốc.');

  } catch (error) {
    console.error('\n❌ LỖI:', error);
    throw error;
  }
}

// Run demo
cloneInstanceDemo().catch(console.error);
