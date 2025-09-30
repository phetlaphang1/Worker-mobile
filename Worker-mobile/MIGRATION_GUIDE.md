# Migration Guide: Browser Twitter → LDPlayer Mobile App

Hướng dẫn chuyển đổi scripts Twitter từ trình duyệt sang app LDPlayer

## So sánh

### Trước (Browser với Puppeteer):
```typescript
import { Page } from 'puppeteer';

// Mở Twitter trên browser
await page.goto('https://twitter.com');

// Login qua form web
await page.type('input[autocomplete="username"]', username);
await page.click('button[type="submit"]');

// Like tweet
await page.click('div[data-testid="like"]');
```

### Sau (LDPlayer App):
```typescript
import TwitterBrowserToMobileAdapter from './automation/TwitterBrowserToMobileAdapter';

// Khởi tạo adapter
const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

// Bật Twitter app trên LDPlayer
await adapter.goto('https://twitter.com');

// Login qua app UI
await adapter.loginTwitter(config);

// Like tweet (tap trên màn hình)
await adapter.likeTweet(400);
```

## Bảng chuyển đổi API

| Browser (Puppeteer) | LDPlayer Mobile | Ghi chú |
|-------------------|-----------------|---------|
| `page.goto('https://twitter.com')` | `adapter.goto('https://twitter.com')` | Bật app thay vì mở URL |
| `loginTwitter(page, config)` | `adapter.loginTwitter(config)` | Login qua app UI |
| `isLoggedIn(page)` | `adapter.isLoggedIn()` | Kiểm tra trạng thái |
| `click(page, xpath)` | `adapter.click(element)` | Tap tọa độ |
| `type(page, xpath, text)` | `adapter.type(text)` | Nhập text qua ADB |
| `page.evaluate(...)` | N/A | Không dùng được, phải tap/swipe |
| `page.waitForSelector(...)` | `await delay(...)` | Dùng delay cố định |
| `page.$$eval('article')` | `adapter.scroll()` | Scroll để xem tweets |

## Ví dụ 1: Chuyển đổi script Like Tweets

### Browser version (Cũ):
```typescript
// server/scripts/samples/twitterAction.ts
import { Page } from 'puppeteer';
import * as actTwitter from '../libs/actTwitter/twitter';

export async function likeTweets(page: Page, config: any) {
  // Login
  await page.goto('https://twitter.com');
  await actTwitter.loginTwitter(page, config);

  // Find and like tweets
  const tweets = await page.$$('article[data-testid="tweet"]');
  for (let i = 0; i < 5; i++) {
    await tweets[i].click('[data-testid="like"]');
    await page.waitForTimeout(2000);
  }
}
```

### Mobile version (Mới):
```typescript
// server/automation/examples/likeTweetsMobile.ts
import TwitterBrowserToMobileAdapter from '../TwitterBrowserToMobileAdapter';
import LDPlayerController from '../../core/LDPlayerController';

export async function likeTweetsMobile(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any
) {
  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  // Launch app and login
  await adapter.goto('https://twitter.com');
  await adapter.loginTwitter(config);

  // Like random tweets while scrolling
  await adapter.likeRandomTweets(5);
}
```

## Ví dụ 2: Post Tweet

### Browser version:
```typescript
export async function postTweet(page: Page, text: string) {
  await page.click('[data-testid="tweetButtonInline"]');
  await page.type('[data-testid="tweetTextarea"]', text);
  await page.click('[data-testid="tweetButton"]');
}
```

### Mobile version:
```typescript
export async function postTweetMobile(
  adapter: TwitterBrowserToMobileAdapter,
  text: string
) {
  await adapter.postTweet(text);
}
```

## Ví dụ 3: Follow Users

### Browser version:
```typescript
export async function followUsers(page: Page, usernames: string[]) {
  for (const username of usernames) {
    await page.goto(`https://twitter.com/${username}`);
    await page.click('[data-testid="follow"]');
    await page.waitForTimeout(3000);
  }
}
```

### Mobile version:
```typescript
export async function followUsersMobile(
  adapter: TwitterBrowserToMobileAdapter,
  usernames: string[]
) {
  for (const username of usernames) {
    await adapter.followUser(username);
  }
}
```

## Cách tích hợp vào TaskExecutor

Thay vì tạo mới Puppeteer browser, dùng adapter:

```typescript
// server/services/TaskExecutor.ts
private async executeTwitterTask(profile: MobileProfile, task: Task) {
  // ❌ Cũ: Browser automation
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();

  // ✅ Mới: LDPlayer app automation
  const adapter = new TwitterBrowserToMobileAdapter(
    this.controller,
    profile.instanceName,
    profile.port
  );

  await adapter.loginTwitter({ profile });

  switch (task.type) {
    case 'twitter_like':
      await adapter.likeRandomTweets(task.data.count);
      break;
    case 'twitter_follow':
      await adapter.followUser(task.data.username);
      break;
    case 'twitter_post':
      await adapter.postTweet(task.data.text);
      break;
  }
}
```

## Các hạn chế & Giải pháp

### 1. Không có XPath/CSS Selector
**Browser**: `await page.click('button[data-testid="like"]')`
**Mobile**: Tap theo tọa độ cố định `await tap(180, 400)`

💡 **Giải pháp**: Sử dụng tọa độ được định nghĩa sẵn trong `TWITTER_ELEMENTS`

### 2. Không có page.evaluate()
**Browser**: `const text = await page.evaluate(el => el.textContent, element)`
**Mobile**: Không thể lấy text trực tiếp

💡 **Giải pháp**: Sử dụng OCR hoặc dựa vào flow logic

### 3. 2FA Authentication
**Browser**: Có thể dùng cookies
**Mobile**: Phải login thủ công lần đầu

💡 **Giải pháp**: Lưu trạng thái login trong profile

### 4. Không scroll chính xác được vị trí
**Browser**: `await page.evaluate(() => window.scrollTo(0, 500))`
**Mobile**: Swipe ước lượng

💡 **Giải pháp**: Scroll nhiều lần nhỏ thay vì 1 lần lớn

## Tips

1. **Sử dụng delays ngẫu nhiên**: Tránh bị phát hiện bot
```typescript
await delay(2000 + Math.random() * 3000);
```

2. **Test trên màn hình 720x1280**: Tọa độ được optimize cho resolution này

3. **Enable humanLike mode**: Simulation các hành vi người dùng
```typescript
new MobileAutomation(controller, {
  humanLike: true,
  minDelay: 800,
  maxDelay: 2500
});
```

4. **Clone base profile**: Nhanh hơn cài app mới mỗi lần
```typescript
await profileManager.cloneProfile(baseProfileId, "New Profile", {
  copyApps: true
});
```

## Lưu ý quan trọng

⚠️ **Twitter app UI thay đổi**: Tọa độ có thể không chính xác nếu Twitter cập nhật UI
⚠️ **Phụ thuộc resolution**: Đảm bảo LDPlayer dùng 720x1280
⚠️ **Không dùng được cookies**: Phải login qua app UI
⚠️ **Rate limiting**: Twitter có giới hạn actions/hour

## Next Steps

1. Chuyển đổi từng script một trong `server/scripts/samples/`
2. Test trên 1 profile trước
3. Scale lên nhiều profiles khi đã ổn định
4. Monitor logs để điều chỉnh tọa độ nếu cần