/**
 * Template Script: Đăng nhập X (Twitter)
 *
 * Hướng dẫn:
 * 1. Tab "Account" → Nhập JSON:
 *    {
 *      "x": {
 *        "username": "myemail@gmail.com",
 *        "password": "MyPassword123"
 *      }
 *    }
 * 2. Mở app X trên LDPlayer
 * 3. Vào tab Inspector trong Profile Details
 * 4. Search các text để tìm XPath:
 *    - Search "username" hoặc "phone" → Lấy XPath của input field
 *    - Search "next" hoặc "tiếp" → Lấy XPath của nút Next
 *    - Search "password" → Lấy XPath của input password
 *    - Search "log in" hoặc "đăng nhập" → Lấy XPath của nút Login
 * 5. Thay thế XPath tìm được vào các biến bên dưới
 * 6. Run script!
 */

// ==========================================
// 🔧 CẤU HÌNH - THAY ĐỔI Ở ĐÂY
// ==========================================

// Lấy thông tin đăng nhập từ tab Account
const accounts = context.profile?.metadata?.accounts || context.profile?.accounts;

if (!accounts || !accounts.x) {
  throw new Error('❌ Chưa có thông tin account X! Vào tab "Account" để nhập username/password');
}

const USERNAME = accounts.x.username;
const PASSWORD = accounts.x.password;

// XPath của các elements - TÌM VÀ THAY ĐỔI
const XPATH = {
  // Màn hình đăng nhập đầu tiên
  usernameInput: '//*[@resource-id="com.twitter.android:id/login_identifier"]',
  // Hoặc dùng text: '//*[@text="Phone, email or username"]'
  // Hoặc: '//android.widget.EditText[1]'

  nextButton: '//*[@resource-id="com.twitter.android:id/cta_button"]',
  // Hoặc: '//*[@text="Next"]'
  // Hoặc: '//android.widget.Button[@text="Next"]'

  // Màn hình password
  passwordInput: '//*[@resource-id="com.twitter.android:id/password_field"]',
  // Hoặc: '//*[@text="Password"]'
  // Hoặc: '//android.widget.EditText[@content-desc="Password"]'

  loginButton: '//*[@resource-id="com.twitter.android:id/login_button"]',
  // Hoặc: '//*[@text="Log in"]'
  // Hoặc: '//android.widget.Button[contains(@text, "Log")]'

  // Optional: XPath để verify đăng nhập thành công
  homeIndicator: '//*[@resource-id="com.twitter.android:id/home_timeline"]'
  // Hoặc: '//*[contains(@resource-id, "home")]'
};

// Cấu hình delays (milliseconds)
const DELAYS = {
  afterInput: 1000,      // Đợi sau khi nhập text
  afterClick: 2000,      // Đợi sau khi click button
  pageLoad: 5000,        // Đợi page load
  verification: 3000     // Đợi verify login
};

// ==========================================
// 📝 SCRIPT LOGIC - KHÔNG CẦN SỬA
// ==========================================

async function loginToX() {
  try {
    log('🚀 Bắt đầu đăng nhập X (Twitter)...');

    // Bước 1: Tìm và nhập username/email
    log('📝 Bước 1: Nhập username/email...');
    const usernameField = await helpers.findElementByXPath(XPATH.usernameInput);

    if (!usernameField) {
      throw new Error('❌ Không tìm thấy username input field. Kiểm tra lại XPath!');
    }

    log(`✅ Tìm thấy username field tại (${usernameField.center.x}, ${usernameField.center.y})`);

    // Click vào field
    await helpers.tap(usernameField.center.x, usernameField.center.y);
    await helpers.sleep(500);

    // Nhập username
    await helpers.inputText(USERNAME);
    log(`✅ Đã nhập username: ${USERNAME}`);
    await helpers.sleep(DELAYS.afterInput);

    // Bước 2: Click nút Next
    log('👆 Bước 2: Click nút Next...');
    const nextBtn = await helpers.findElementByXPath(XPATH.nextButton);

    if (!nextBtn) {
      throw new Error('❌ Không tìm thấy Next button. Kiểm tra lại XPath!');
    }

    await helpers.tap(nextBtn.center.x, nextBtn.center.y);
    log('✅ Đã click Next button');
    await helpers.sleep(DELAYS.pageLoad);

    // Bước 3: Tìm và nhập password
    log('🔐 Bước 3: Nhập password...');
    const passwordField = await helpers.findElementByXPath(XPATH.passwordInput);

    if (!passwordField) {
      throw new Error('❌ Không tìm thấy password field. Kiểm tra lại XPath!');
    }

    log(`✅ Tìm thấy password field tại (${passwordField.center.x}, ${passwordField.center.y})`);

    // Click vào field
    await helpers.tap(passwordField.center.x, passwordField.center.y);
    await helpers.sleep(500);

    // Nhập password
    await helpers.inputText(PASSWORD);
    log('✅ Đã nhập password');
    await helpers.sleep(DELAYS.afterInput);

    // Bước 4: Click nút Login
    log('🚪 Bước 4: Click nút Login...');
    const loginBtn = await helpers.findElementByXPath(XPATH.loginButton);

    if (!loginBtn) {
      throw new Error('❌ Không tìm thấy Login button. Kiểm tra lại XPath!');
    }

    await helpers.tap(loginBtn.center.x, loginBtn.center.y);
    log('✅ Đã click Login button');
    await helpers.sleep(DELAYS.verification);

    // Bước 5: Verify đăng nhập thành công
    log('✔️ Bước 5: Kiểm tra đăng nhập...');
    const homeElement = await helpers.findElementByXPath(XPATH.homeIndicator);

    if (homeElement) {
      log('🎉 ĐĂNG NHẬP THÀNH CÔNG!');
      log('✅ Đã vào màn hình Home');
      return { success: true, message: 'Login successful' };
    } else {
      log('⚠️ Không thấy Home screen. Có thể cần verify 2FA hoặc CAPTCHA');
      return { success: false, message: 'Login may require additional verification' };
    }

  } catch (error) {
    log(`❌ LỖI: ${error.message}`);
    log('💡 Gợi ý: Kiểm tra lại XPath trong phần CẤU HÌNH');
    return { success: false, error: error.message };
  }
}

// Chạy script
await loginToX();
