/**
 * Script đăng nhập X (Twitter) - PHIÊN BẢN ROBUST
 *
 * Xử lý các vấn đề:
 * - Nút Next không có text rõ ràng
 * - Nút Next bị disabled ban đầu
 * - XPath thay đổi động
 * - Dùng nhiều fallback strategies
 */

// ==========================================
// CẤU HÌNH
// ==========================================

// Lấy account từ tab Account
const accounts = context.profile?.metadata?.accounts || context.profile?.accounts;

if (!accounts || !accounts.x) {
  log('❌ Chưa có thông tin account X!');
  log('Vào tab "Account" và nhập JSON:');
  log('{"x": {"username": "...", "password": "..."}}');
  throw new Error('Missing account');
}

const USERNAME = accounts.x.username;
const PASSWORD = accounts.x.password;

// XPath - Thay bằng XPath bạn tìm được
const XPATH = {
  usernameInput: '//*[@resource-id="com.twitter.android:id/login_identifier"]',
  // Nhiều cách tìm nút Next (sẽ thử lần lượt)
  nextButton: [
    '//*[@text="Next"]',
    '//*[@content-desc="Next"]',
    '//*[@resource-id="com.twitter.android:id/cta_button"]',
    '//android.widget.Button[@clickable="true"]'
  ],
  passwordInput: '//*[@resource-id="com.twitter.android:id/password_field"]',
  loginButton: '//*[@text="Log in"]'
};

// Tọa độ tương đối của nút Next (nếu XPath fail)
const NEXT_BUTTON_RELATIVE = {
  x: 0.85,  // 85% chiều ngang (bên phải)
  y: 0.90   // 90% chiều dọc (dưới cùng)
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Tìm và click nút Next bằng nhiều cách
 */
async function findAndClickNext() {
  log('🔍 Tìm nút Next...');

  // Strategy 1: Thử từng XPath trong list
  for (const xpath of XPATH.nextButton) {
    try {
      log(`  Thử XPath: ${xpath.substring(0, 50)}...`);
      const element = await helpers.findElementByXPath(xpath);

      if (element) {
        log(`  ✅ Tìm thấy bằng XPath!`);
        await helpers.tap(element.center.x, element.center.y);
        return true;
      }
    } catch (err) {
      log(`  ⚠️ XPath này không work: ${err.message}`);
    }
  }

  // Strategy 2: Tìm tất cả buttons, lấy button ở góc dưới phải
  log('  Strategy 2: Tìm button theo vị trí...');
  try {
    const allButtons = await helpers.findElementsByXPath('//android.widget.Button[@clickable="true"]');

    if (allButtons && allButtons.length > 0) {
      log(`  Tìm thấy ${allButtons.length} buttons clickable`);

      // Lấy button ở góc dưới bên phải
      const nextBtn = allButtons.reduce((candidate, btn) => {
        // Ưu tiên button ở dưới và bên phải
        const score = btn.bounds.y2 + btn.bounds.x2;
        const candidateScore = candidate.bounds.y2 + candidate.bounds.x2;
        return score > candidateScore ? btn : candidate;
      }, allButtons[0]);

      log(`  ✅ Tìm thấy button tại (${nextBtn.center.x}, ${nextBtn.center.y})`);
      await helpers.tap(nextBtn.center.x, nextBtn.center.y);
      return true;
    }
  } catch (err) {
    log(`  ⚠️ Strategy 2 failed: ${err.message}`);
  }

  // Strategy 3: Dùng tọa độ tương đối (fallback cuối cùng)
  log('  Strategy 3: Dùng tọa độ tương đối...');
  try {
    const screenSize = await helpers.getScreenSize();
    const x = Math.floor(screenSize.width * NEXT_BUTTON_RELATIVE.x);
    const y = Math.floor(screenSize.height * NEXT_BUTTON_RELATIVE.y);

    log(`  Click vào vị trí ước tính: (${x}, ${y})`);
    await helpers.tap(x, y);
    return true;
  } catch (err) {
    log(`  ❌ Strategy 3 failed: ${err.message}`);
  }

  throw new Error('Không thể tìm thấy nút Next bằng bất kỳ cách nào!');
}

/**
 * Verify đã chuyển sang màn hình password chưa
 */
async function isPasswordScreenVisible() {
  try {
    const passwordField = await helpers.findElementByXPath(XPATH.passwordInput);
    return passwordField !== null;
  } catch {
    return false;
  }
}

// ==========================================
// MAIN SCRIPT
// ==========================================

async function loginToX() {
  try {
    log('🚀 Bắt đầu đăng nhập X (Twitter)');
    log(`📧 Account: ${USERNAME}`);

    // ========================================
    // BƯỚC 1: Nhập Username
    // ========================================
    log('\n📝 BƯỚC 1: Nhập username...');

    const usernameField = await helpers.findElementByXPath(XPATH.usernameInput);

    if (!usernameField) {
      throw new Error('❌ Không tìm thấy username input field!');
    }

    log(`✅ Tìm thấy username field tại (${usernameField.center.x}, ${usernameField.center.y})`);

    // Click và nhập
    await helpers.tap(usernameField.center.x, usernameField.center.y);
    await helpers.sleep(500);
    await helpers.inputText(USERNAME);
    log('✅ Đã nhập username');

    // Đợi nút Next enabled (QUAN TRỌNG!)
    await helpers.sleep(1500);

    // ========================================
    // BƯỚC 2: Click nút Next (BƯỚC KHÓ!)
    // ========================================
    log('\n👆 BƯỚC 2: Click nút Next...');

    await findAndClickNext();
    log('✅ Đã click nút Next');

    // Đợi màn hình password load
    await helpers.sleep(3000);

    // Verify đã sang màn hình password
    const isPasswordScreen = await isPasswordScreenVisible();

    if (!isPasswordScreen) {
      log('⚠️ WARNING: Chưa thấy màn hình password!');
      log('💡 Thử click Next lần nữa...');
      await findAndClickNext();
      await helpers.sleep(3000);
    }

    // ========================================
    // BƯỚC 3: Nhập Password
    // ========================================
    log('\n🔐 BƯỚC 3: Nhập password...');

    const passwordField = await helpers.findElementByXPath(XPATH.passwordInput);

    if (!passwordField) {
      throw new Error('❌ Không tìm thấy password field! Có thể nút Next chưa được click?');
    }

    log(`✅ Tìm thấy password field tại (${passwordField.center.x}, ${passwordField.center.y})`);

    // Click và nhập password
    await helpers.tap(passwordField.center.x, passwordField.center.y);
    await helpers.sleep(500);
    await helpers.inputText(PASSWORD);
    log('✅ Đã nhập password');

    await helpers.sleep(1500);

    // ========================================
    // BƯỚC 4: Click nút Login
    // ========================================
    log('\n🚪 BƯỚC 4: Click nút Login...');

    const loginBtn = await helpers.findElementByXPath(XPATH.loginButton);

    if (!loginBtn) {
      throw new Error('❌ Không tìm thấy Login button!');
    }

    log(`✅ Tìm thấy Login button tại (${loginBtn.center.x}, ${loginBtn.center.y})`);
    await helpers.tap(loginBtn.center.x, loginBtn.center.y);
    log('✅ Đã click Login button');

    // Đợi login process
    await helpers.sleep(5000);

    log('\n🎉 HOÀN THÀNH ĐĂNG NHẬP!');
    log('✅ Kiểm tra app để xem đã vào được chưa');

    return { success: true, message: 'Login completed' };

  } catch (error) {
    log(`\n❌ LỖI: ${error.message}`);
    log('\n💡 GỢI Ý DEBUG:');
    log('1. Kiểm tra XPath trong phần CẤU HÌNH');
    log('2. Thử chạy từng bước thủ công để xem bước nào lỗi');
    log('3. Dùng UI Inspector SAU KHI nhập username để tìm nút Next');
    log('4. Adjust tọa độ tương đối NEXT_BUTTON_RELATIVE nếu cần');

    return { success: false, error: error.message };
  }
}

// Chạy script
await loginToX();
