# 🛡️ Anti-Detection Integration Guide

## Overview
Hệ thống anti-detection giúp bypass các cơ chế phát hiện bot của các website, đặc biệt là các mạng xã hội như Twitter/X.

## Cấu trúc

### 1. Core Modules
- **fingerprint-generator**: Tạo browser fingerprints giống thật
- **fingerprint-injector**: Inject fingerprint vào Puppeteer/Playwright
- **header-generator**: Tạo HTTP headers phù hợp

### 2. Stealth Features
- ✅ Override navigator.webdriver
- ✅ Fake browser fingerprint (screen, plugins, WebGL...)
- ✅ Realistic HTTP headers
- ✅ Human-like delays và mouse movements
- ✅ Random scrolling patterns
- ✅ Character-by-character typing
- ✅ WebRTC blocking

## Sử dụng

### Basic Setup
```typescript
import * as browser from "./libs/browser";

// Tạo browser với anti-detection
const stealthBrowser = await browser.createStealthBrowser({
    headless: false,
    fingerprint: {
        browsers: ['chrome'],
        devices: ['desktop'],
        operatingSystems: ['windows'],
        locales: ['en-US']
    }
});

// Tạo page với fingerprint injection
const page = await browser.createStealthPage(stealthBrowser);
```

### Human-like Actions
```typescript
// Random delays
await browser.randomSleep(1000, 3000);

// Natural scrolling
await browser.humanLikeScroll(page);

// Random mouse movements
await browser.moveMouseRandomly(page);

// Type like human (character by character)
for (const char of text) {
    await page.keyboard.type(char);
    await browser.randomSleep(50, 150);
}
```

## Data Files
Các file data cần thiết đã có sẵn trong:
- `/antidetect/fingerprint-generator copy/src/data_files/`
  - `fingerprint-network-definition.zip` - Bayesian network cho fingerprint
  - `network.json` - Network data

- `/antidetect/header-generator copy/src/data_files/`
  - `header-network-definition.zip` - Network cho headers
  - `input-network-definition.zip` - Input definitions

**Lưu ý**: Không cần giải nén, code sẽ tự động đọc từ file .zip

## Comparison

### Old Scripts (Dễ detect)
```typescript
// ❌ Direct Puppeteer
await page.click(xpath);
await page.type(xpath, text);
```

### New Stealth Scripts (Khó detect)
```typescript
// ✅ With anti-detection
await browser.randomSleep(500, 1500);
await browser.moveMouseRandomly(page);
await page.click(selector);
// Auto delays, fingerprint injection, etc.
```

## Testing Detection

Test tại các website:
- https://bot.sannysoft.com/
- https://fingerprintjs.com/demo/
- https://browserleaks.com/javascript

## Best Practices

1. **Always use random delays** - Không click/type quá nhanh
2. **Mimic human behavior** - Scroll, pause, read content
3. **Use residential proxies** - Tránh datacenter IPs
4. **Rotate fingerprints** - Đổi fingerprint mỗi session
5. **Don't overuse** - Limit actions per account/IP
6. **Monitor detection** - Check regularly với test sites

## Integration với Worker

1. Replace `puppeteer.launch()` với `browser.createStealthBrowser()`
2. Replace `browser.newPage()` với `browser.createStealthPage()`
3. Add random delays trước mọi action
4. Use human-like scrolling và mouse movements
5. Type character-by-character với random speed

## Troubleshooting

- **"Cannot find module"**: Check paths to antidetect modules
- **"Network definition not found"**: Ensure .zip files exist
- **Still detected**: Increase delays, use better proxies
- **Performance issues**: Enable `slim: true` in fingerprint options