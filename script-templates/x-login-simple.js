/**
 * Script đăng nhập X (Twitter) - PHIÊN BẢN ĐƠN GIẢN
 *
 * Cấu hình:
 * 1. Tab "Account" → Nhập JSON:
 *    {
 *      "x": {
 *        "username": "myemail@gmail.com",
 *        "password": "MyPassword123"
 *      }
 *    }
 * 2. Tìm XPath bằng UI Inspector → Thay vào dưới
 * 3. Run script!
 */

// ==========================================
// THAY ĐỔI XPath Ở ĐÂY
// ==========================================

// XPath tìm được từ UI Inspector
const USERNAME_XPATH = '//*[@resource-id="com.twitter.android:id/login_identifier"]';
const NEXT_BUTTON_XPATH = '//*[@text="Next"]';
const PASSWORD_XPATH = '//*[@resource-id="com.twitter.android:id/password_field"]';
const LOGIN_BUTTON_XPATH = '//*[@text="Log in"]';

// ==========================================
// LẤY USERNAME/PASSWORD TỪ TAB ACCOUNT
// ==========================================

// Lấy account info từ profile metadata
const accounts = context.profile?.metadata?.accounts || context.profile?.accounts;

if (!accounts || !accounts.x) {
  log('❌ Chưa có thông tin account!');
  log('💡 Vào tab "Account" và nhập JSON:');
  log(`{
  "x": {
    "username": "your_email@gmail.com",
    "password": "your_password"
  }
}`);
  throw new Error('Missing account credentials');
}

const USERNAME = accounts.x.username;
const PASSWORD = accounts.x.password;

log(`📧 Sử dụng account: ${USERNAME}`);

// ==========================================
// SCRIPT - KHÔNG SỬA
// ==========================================

log('🚀 Đăng nhập X...');

// Nhập username
const usernameEl = await helpers.findElementByXPath(USERNAME_XPATH);
await helpers.tap(usernameEl.center.x, usernameEl.center.y);
await helpers.sleep(500);
await helpers.inputText(USERNAME);
await helpers.sleep(1000);

// Click Next
const nextBtn = await helpers.findElementByXPath(NEXT_BUTTON_XPATH);
await helpers.tap(nextBtn.center.x, nextBtn.center.y);
await helpers.sleep(3000);

// Nhập password
const passwordEl = await helpers.findElementByXPath(PASSWORD_XPATH);
await helpers.tap(passwordEl.center.x, passwordEl.center.y);
await helpers.sleep(500);
await helpers.inputText(PASSWORD);
await helpers.sleep(1000);

// Click Login
const loginBtn = await helpers.findElementByXPath(LOGIN_BUTTON_XPATH);
await helpers.tap(loginBtn.center.x, loginBtn.center.y);
await helpers.sleep(5000);

log('✅ Hoàn thành!');
