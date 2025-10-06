/**
 * Test script: Cài đặt X vào instance mẫu
 * Chạy: tsx test-install-x.ts
 */

import LDPlayerController from './server/core/LDPlayerController.js';
import { logger } from './server/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function testInstallX() {
  const controller = new LDPlayerController();

  try {
    console.log('\n=== BẮT ĐẦU TEST CÀI ĐẶT X ===\n');

    // Step 1: Tạo instance mới
    console.log('📱 Bước 1: Tạo instance mẫu...');
    const instanceName = 'X_Demo_Instance';
    const instance = await controller.createInstance(instanceName, {
      resolution: '360,640',
      dpi: 160,
      cpu: 2,
      memory: 2048
    });

    console.log(`✅ Instance đã tạo: ${instance.name}`);
    console.log(`   - Port: ${instance.port}`);
    console.log(`   - Index: ${instance.index}\n`);

    // Step 2: Launch instance
    console.log('🚀 Bước 2: Khởi động instance...');
    await controller.launchInstance(instanceName);
    console.log('✅ Instance đã khởi động\n');

    // Wait for boot
    console.log('⏳ Đợi instance boot xong...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15s
    console.log('✅ Instance đã sẵn sàng\n');

    // Step 3: Connect ADB
    console.log('🔌 Bước 3: Kết nối ADB...');
    await controller.connectADB(instance.port);
    console.log('✅ ADB đã kết nối\n');

    // Step 4: Install X APK
    console.log('📲 Bước 4: Cài đặt X (Twitter)...');
    const apkPath = process.env.TWITTER_APK_PATH || './apks/com.twitter.android.apk';
    console.log(`   APK Path: ${apkPath}`);

    await controller.installAPK(instance.port, apkPath);
    console.log('✅ X đã được cài đặt!\n');

    // Step 5: Verify installation
    console.log('🔍 Bước 5: Kiểm tra X đã cài thành công...');
    const isInstalled = await controller.isAppInstalled(instance.port, 'com.twitter.android');

    if (isInstalled) {
      console.log('✅ X đã được cài đặt thành công!\n');

      // Step 6: Launch X
      console.log('🎯 Bước 6: Khởi chạy X...');
      await controller.launchApp(instance.port, 'com.twitter.android');
      console.log('✅ X đã được khởi chạy!\n');

      console.log('🎉 === TEST HOÀN TẤT ===');
      console.log('\nInstance đang chạy với X app.');
      console.log('Bạn có thể kiểm tra trực tiếp trên LDPlayer.');
      console.log('\nĐể dừng instance, chạy:');
      console.log(`"${process.env.LDCONSOLE_PATH}" quit --name "${instanceName}"`);

    } else {
      console.log('❌ Không thể xác nhận X đã cài đặt');
    }

  } catch (error) {
    console.error('\n❌ LỖI:', error);
    throw error;
  }
}

// Run test
testInstallX().catch(console.error);
