# 🤖 Appium Integration Guide - Puppeteer-like API for Mobile Automation

## 📋 Tổng Quan

Worker-mobile đã được tích hợp **Appium** với **Puppeteer-like API**, cho phép bạn viết automation scripts cho mobile devices (LDPlayer) giống như cách bạn viết cho browser với Puppeteer.

### ✨ Điểm Nổi Bật

- **🎯 API Quen Thuộc**: Sử dụng cú pháp Puppeteer (page.click, page.type, page.waitForSelector...)
- **📱 Mobile Native**: Chạy trực tiếp trên Android apps (không cần browser)
- **🔄 Easy Migration**: Chuyển đổi dễ dàng từ browser scripts sang mobile scripts
- **🛠️ Full-Featured**: Hỗ trợ đầy đủ tính năng automation (tap, swipe, gestures, app management)

---

## 🚀 Quick Start

### 1. Cài Đặt Dependencies

Dependencies đã được cài sẵn trong `package.json`:
- `appium` - Appium server
- `webdriverio` - WebDriver client
- `@wdio/appium-service` - Appium service cho WDIO
- `adb-ts` - Android Debug Bridge TypeScript bindings

### 2. Start Appium Server

```bash
# Terminal 1: Start Appium server
npx appium

# Hoặc cài global:
npm install -g appium
appium
```

Appium server sẽ chạy ở `http://127.0.0.1:4723`

### 3. Khởi Động LDPlayer Instance

```bash
# Sử dụng LDPlayerController
npm run dev
```

Trong code:
```typescript
import LDPlayerController from './server/core/LDPlayerController';

const controller = new LDPlayerController();
const instance = await controller.createInstance('test-instance');
await controller.launchInstance('test-instance');
```

### 4. Viết Script Đầu Tiên

**Cách 1: Sử dụng AppiumRunner**

```javascript
import { AppiumRunner } from './server/automation/AppiumRunner';

const runner = new AppiumRunner(controller, {
  instanceName: 'test-instance',
  port: 5555,
  appiumPort: 4723
});

const scriptCode = `
  // Launch Twitter app
  await page.goto('com.twitter.android');
  await helpers.sleep(2000);

  // Take screenshot
  await helpers.screenshot('twitter_home.png');

  // Click login button
  await page.click('~login_button');

  return { success: true };
`;

const result = await runner.runScript(scriptCode);
console.log(result);
```

**Cách 2: Sử dụng MobilePage trực tiếp**

```typescript
import { remote } from 'webdriverio';
import { MobilePage } from './server/automation/MobilePageAdapter';

// Create Appium session
const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'Android',
    'appium:deviceName': 'test-instance',
    'appium:udid': '127.0.0.1:5555',
    'appium:automationName': 'UiAutomator2',
  }
});

// Wrap với MobilePage
const page = new MobilePage(driver, controller, 5555);

// Sử dụng Puppeteer-like API
await page.goto('com.twitter.android');
await page.click('~username_field');
await page.type('~username_field', 'myusername');
await page.screenshot({ path: 'screenshot.png' });
```

---

## 📚 API Reference

### MobilePage Methods

#### Navigation

```typescript
// Launch app by package name
await page.goto('com.twitter.android');

// Navigate to URL (if webview)
await page.goto('https://example.com');

// Go back (Android back button)
await page.goBack();

// Go home
await page.goHome();

// Reload app
await page.reload();
```

#### Element Selection

```typescript
// Find single element
const element = await page.$('~accessibility_id');
const element2 = await page.$('android=new UiSelector().text("Login")');
const element3 = await page.$('//android.widget.Button[@text="Submit"]');

// Find multiple elements
const elements = await page.$$('android=new UiSelector().className("android.widget.Button")');

// Wait for element
await page.waitForSelector('~login_button', { timeout: 10000 });

// Check visibility
const isVisible = await page.isVisible('~my_element');
```

#### Interactions

```typescript
// Click element
await page.click('~button_id');

// Click by coordinates
await page.click(540, 960);

// Double click
await page.click('~button', undefined, { clickCount: 2 });

// Type text
await page.type('~input_field', 'Hello World');

// Type with delay (human-like)
await page.type('~input_field', 'Hello', { delay: 100 });

// Tap coordinates (mobile-specific)
await page.tap(540, 960);

// Swipe gesture
await page.swipe(540, 1000, 540, 500, 300);

// Scroll
await page.scrollDown();
await page.scrollUp();

// Press Android key
await page.pressKey('KEYCODE_BACK');
await page.pressKey('KEYCODE_HOME');
await page.pressKey('KEYCODE_ENTER');
```

#### Content Access

```typescript
// Get text content
const text = await page.textContent('~element_id');

// Get attribute
const value = await page.getAttribute('~element_id', 'text');

// Get page title (current activity)
const title = await page.title();

// Get URL (current package)
const pkg = await page.url();
```

#### Screenshots & Media

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' });

// Screenshot returns base64 string
const base64 = await page.screenshot();
```

#### App Management

```typescript
// Launch app
await page.launchApp('com.twitter.android');

// Close app
await page.closeApp('com.twitter.android');

// Get current app
const currentApp = await page.url();
```

### AppiumRunner Helpers

Khi sử dụng `AppiumRunner`, scripts có access đến các helper functions:

```javascript
// Sleep
await helpers.sleep(2000);

// Random delay (human-like)
await helpers.randomDelay(1000, 3000);

// Screenshot with auto-naming
await helpers.screenshot('my_screen.png');

// Logging
helpers.log('My log message');

// Find by text
const element = await helpers.findByText('Login');

// Tap with offset (randomization)
await helpers.tapWithOffset(540, 960, 5, 5);

// Swipe shortcuts
await helpers.swipeLeft();
await helpers.swipeRight();

// Install APK
await helpers.installAPK('/path/to/app.apk');

// Launch app
await helpers.launchApp('com.twitter.android');

// Get current app
const pkg = await helpers.getCurrentApp();

// Access LDPlayerController
await helpers.ldplayer.installAPK(port, '/path/to/app.apk');
```

---

## 🎯 Android Selector Guide

### 1. Accessibility ID (Recommended)

```javascript
// Format: ~accessibility_id
await page.click('~login_button');
await page.waitForSelector('~username_field');
```

### 2. Android UiAutomator

```javascript
// By resource ID
'android=new UiSelector().resourceId("com.twitter.android:id/username")'

// By text
'android=new UiSelector().text("Login")'

// By text contains
'android=new UiSelector().textContains("Log")'

// By class name
'android=new UiSelector().className("android.widget.Button")'

// By description
'android=new UiSelector().description("Submit button")'

// Combined
'android=new UiSelector().className("android.widget.EditText").instance(0)'
```

### 3. XPath

```javascript
// Basic XPath
'//android.widget.Button[@text="Login"]'

// By resource-id
'//android.widget.EditText[@resource-id="username"]'

// By content-desc
'//*[@content-desc="login_button"]'

// Complex XPath
'//android.widget.LinearLayout/android.widget.Button[2]'
```

### 4. Text Selector

```javascript
// Exact text match
'text=Login'

// Partial match
'text=*Log*'
```

---

## 🔄 Migration từ Puppeteer/Browser

### Browser Script (Puppeteer)

```javascript
// Puppeteer browser automation
const browser = await puppeteer.launch();
const page = await browser.newPage();

await page.goto('https://twitter.com/login');
await page.click('[name="session[username_or_email]"]');
await page.type('[name="session[username_or_email]"]', 'myusername');
await page.waitForSelector('[data-testid="LoginForm_Login_Button"]');
await page.screenshot({ path: 'screenshot.png' });

await browser.close();
```

### Mobile Script (Appium với MobilePage)

```javascript
// Mobile automation với Puppeteer-like API
const runner = new AppiumRunner(controller, config);

const script = `
  await page.goto('com.twitter.android');
  await page.click('~username_field');
  await page.type('~username_field', 'myusername', { delay: 50 });
  await page.waitForSelector('~login_button');
  await page.screenshot({ path: 'screenshot.png' });
`;

await runner.runScript(script);
await runner.close();
```

### Conversion Table

| Browser (Puppeteer) | Mobile (Appium) | Notes |
|---------------------|-----------------|-------|
| `page.goto(url)` | `page.goto(packageName)` | Launch app instead of URL |
| `page.click(cssSelector)` | `page.click(mobileSelector)` | Use Android selectors |
| `page.type(selector, text)` | `page.type(selector, text)` | Same API! |
| `page.waitForSelector(selector)` | `page.waitForSelector(selector)` | Same API! |
| `page.$eval()` | `page.textContent()` | Limited JS execution |
| `page.screenshot()` | `page.screenshot()` | Same API! |
| `page.evaluate(() => window.scrollBy())` | `page.scrollDown()` | Use swipe gestures |
| `page.mouse.click(x, y)` | `page.tap(x, y)` | Tap instead of mouse |
| N/A | `page.pressKey('KEYCODE_BACK')` | Android-specific |
| N/A | `page.swipe(x1, y1, x2, y2)` | Mobile gestures |

---

## 💼 Use Cases

### 1. Twitter Mobile Automation

```javascript
// Twitter login + post tweet
await page.goto('com.twitter.android');
await page.click('~login_button');
await page.type('~username', config.twitter_account.username);
await page.type('~password', config.twitter_account.password);
await page.click('~submit_button');

await page.waitForSelector('~compose_tweet');
await page.click('~compose_tweet');
await page.type('~tweet_text', 'Hello from automation!');
await page.click('~tweet_button');
```

### 2. App Testing

```javascript
// Test app installation and launch
await helpers.installAPK('/path/to/app.apk');
await helpers.sleep(2000);
await page.goto('com.myapp.android');

// Verify UI elements
const isLogoVisible = await page.isVisible('~app_logo');
assert(isLogoVisible, 'Logo should be visible');

// Take screenshots for visual testing
await helpers.screenshot('home_screen.png');
```

### 3. Social Media Automation

```javascript
// Instagram-like automation
await page.goto('com.instagram.android');
await page.click('~profile_tab');
await page.scrollDown();
await helpers.screenshot('profile.png');

// Like posts
const likeBtns = await page.$$('~like_button');
for (let i = 0; i < 3; i++) {
  await likeBtns[i].click();
  await helpers.randomDelay(2000, 4000);
}
```

---

## 🛠️ Troubleshooting

### Appium Connection Issues

```bash
# Check if Appium is running
curl http://127.0.0.1:4723/status

# Restart Appium
pkill -f appium
npx appium
```

### ADB Connection Issues

```bash
# Check connected devices
adb devices

# Reconnect to LDPlayer
adb connect 127.0.0.1:5555
```

### Element Not Found

```javascript
// Increase timeout
await page.waitForSelector('~element', { timeout: 30000 });

// Try different selectors
const selectors = [
  '~accessibility_id',
  'android=new UiSelector().text("Button")',
  '//android.widget.Button[@text="Button"]'
];

for (const sel of selectors) {
  const el = await page.$(sel);
  if (el) {
    await el.click();
    break;
  }
}

// Take screenshot to debug
await helpers.screenshot('debug.png');
```

### Script Timeout

```typescript
// Increase Appium timeout
const runner = new AppiumRunner(controller, {
  instanceName: 'test',
  port: 5555,
  capabilities: {
    'appium:newCommandTimeout': 600 // 10 minutes
  }
});
```

---

## 📁 Project Structure

```
server/
├── automation/
│   ├── AppiumRunner.ts              # Main script runner
│   ├── MobilePageAdapter.ts         # Puppeteer-like Page API
│   ├── MobileAutomation.ts          # Human-like automation helpers
│   └── TwitterBrowserToMobileAdapter.ts  # Twitter-specific adapter
│
├── scripts/
│   └── examples/
│       ├── twitter-mobile-login.js           # Twitter login example
│       ├── basic-mobile-actions.js           # Basic actions demo
│       └── browser-to-mobile-conversion.js   # Conversion guide
│
├── services/
│   └── AppiumScriptService.ts       # Script execution service
│
└── core/
    └── LDPlayerController.ts         # LDPlayer management
```

---

## 📖 Examples

Xem thêm examples trong `server/scripts/examples/`:

1. **twitter-mobile-login.js** - Twitter login automation
2. **basic-mobile-actions.js** - Common mobile actions
3. **browser-to-mobile-conversion.js** - Browser to mobile conversion guide

---

## 🔗 Resources

- [Appium Documentation](http://appium.io/docs/en/about-appium/intro/)
- [WebdriverIO API](https://webdriver.io/docs/api)
- [Android UiAutomator](https://developer.android.com/training/testing/other-components/ui-automator)
- [LDPlayer Console Commands](https://www.ldplayer.net/)

---

## 🎓 Best Practices

1. **Sử dụng Accessibility IDs** khi có thể (dễ maintain nhất)
2. **Add delays** giữa các actions để app kịp render
3. **Take screenshots** thường xuyên để debug
4. **Use human-like delays** (`helpers.randomDelay()`) để tránh detection
5. **Handle errors gracefully** với try-catch
6. **Test selectors** trước khi chạy full script

---

## 🚦 Next Steps

1. ✅ Cài Appium server
2. ✅ Start LDPlayer instance
3. ✅ Chạy example scripts
4. ✅ Viết automation scripts của bạn
5. ✅ Tích hợp vào Worker-mobile workflow

Happy Automating! 🎉
