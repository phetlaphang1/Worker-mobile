/**
 * Test script: Cài đặt X vào instance CÓ SẴN
 * Chạy: npx tsx test-install-x-existing.ts
 */

import LDPlayerController from './server/core/LDPlayerController.js';
import dotenv from 'dotenv';

dotenv.config();

async function testInstallX() {
  const controller = new LDPlayerController();

  try {
    console.log('\n=== BẮT ĐẦU TEST CÀI ĐẶT X VÀO INSTANCE CÓ SẴN ===\n');

    // Sử dụng instance có sẵn từ list
    const instanceName = 'X-NODE-TEST'; // Instance #22 từ list
    const port = 5555; // Port mặc định cho index 0, tùy chỉnh nếu cần

    console.log(`📱 Sử dụng instance: ${instanceName}`);
    console.log(`   Port: ${port}\n`);

    // Step 1: Launch instance nếu chưa chạy
    console.log('🚀 Bước 1: Khởi động instance (nếu chưa chạy)...');
    try {
      await controller.launchInstance(instanceName);
      console.log('✅ Instance đã khởi động\n');

      // Wait for boot
      console.log('⏳ Đợi instance boot xong (20s)...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      console.log('✅ Instance đã sẵn sàng\n');
    } catch (error: any) {
      console.log('⚠️  Instance có thể đã chạy rồi, tiếp tục...\n');
    }

    // Step 2: Connect ADB với port tính toán từ index
    // Index 22 -> port = 5555 + 22*2 = 5599
    const calculatedPort = 5555 + 22 * 2;
    console.log(`🔌 Bước 2: Kết nối ADB với port ${calculatedPort}...`);

    try {
      await controller.connectADB(calculatedPort);
      console.log('✅ ADB đã kết nối\n');
    } catch (error) {
      console.log('⚠️  ADB có thể đã kết nối, tiếp tục...\n');
    }

    // Step 3: Kiểm tra X đã cài chưa
    console.log('🔍 Bước 3: Kiểm tra X đã cài chưa...');
    const isAlreadyInstalled = await controller.isAppInstalled(calculatedPort, 'com.twitter.android');

    if (isAlreadyInstalled) {
      console.log('✅ X đã được cài sẵn!\n');
      console.log('🎯 Khởi chạy X...');
      await controller.launchApp(calculatedPort, 'com.twitter.android');
      console.log('✅ X đã được khởi chạy!\n');
      console.log('🎉 === HOÀN TẤT ===');
      return;
    }

    console.log('ℹ️  X chưa được cài, tiến hành cài đặt...\n');

    // Step 4: Install X APK
    console.log('📲 Bước 4: Cài đặt X (Twitter)...');
    const apkPath = process.env.TWITTER_APK_PATH || './apks/com.twitter.android.apk';
    console.log(`   APK Path: ${apkPath}`);

    await controller.installAPK(calculatedPort, apkPath);
    console.log('✅ X đã được cài đặt!\n');

    // Step 5: Verify installation
    console.log('🔍 Bước 5: Xác nhận cài đặt...');
    const isInstalled = await controller.isAppInstalled(calculatedPort, 'com.twitter.android');

    if (isInstalled) {
      console.log('✅ X đã được cài đặt thành công!\n');

      // Step 6: Launch X
      console.log('🎯 Bước 6: Khởi chạy X...');
      await controller.launchApp(calculatedPort, 'com.twitter.android');
      console.log('✅ X đã được khởi chạy!\n');

      console.log('🎉 === TEST HOÀN TẤT ===');
      console.log('\nBạn có thể kiểm tra X app trên LDPlayer.');

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
