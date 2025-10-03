# Auto-Run Scripts - Tự động chạy scripts khi launch instance

## Tổng quan

Worker Mobile giờ hỗ trợ assign scripts để tự động chạy khi launch instance, giống như Worker trên trình duyệt!

## Cách sử dụng

### 1. Tạo Profile với Auto-Run Scripts

Khi tạo profile mới (click nút **New Profile**):

1. **Nhập tên profile** (bắt buộc)
2. **Chọn apps** cài sẵn (tùy chọn)
3. **Assign scripts** tự động chạy (tùy chọn):
   - Click nút **Add Script**
   - Chọn script từ dropdown
   - Nhập parameters (count, searchQuery, text, username...)
   - Click **Add** để thêm vào danh sách
   - Lặp lại để thêm nhiều scripts

4. Click **Create Profile**

### 2. Scripts sẽ tự động chạy

Khi launch profile:
- Instance boot lên (5 giây)
- Các scripts được assigned sẽ **TỰ ĐỘNG CHẠY** theo thứ tự
- Không cần click "Run Script" thủ công nữa!

### 3. Profile không có scripts

Nếu profile **không assign scripts**:
- Instance vẫn launch bình thường
- Tự động mở Google/Chrome (như cũ)
- Sẵn sàng để bạn tương tác thủ công

## Ví dụ cụ thể

### Ví dụ 1: Auto-like Bitcoin tweets

**Setup:**
1. Tạo profile mới: "Bitcoin Liker"
2. Chọn app: Twitter/X
3. Add Script:
   - Script: `likeTweets`
   - Search Query: `bitcoin`
   - Count: `10`
4. Create Profile

**Kết quả:**
- Launch profile → Instance tự động:
  - Mở Twitter
  - Tìm kiếm "bitcoin"
  - Like 10 tweets đầu tiên
  - DONE!

### Ví dụ 2: Multi-script automation

**Setup:**
1. Tạo profile: "Crypto Engagement Bot"
2. Chọn apps: Twitter/X
3. Add Script #1:
   - Script: `likeTweets`
   - Search Query: `bitcoin OR crypto`
   - Count: `5`
4. Add Script #2:
   - Script: `retweetTweets`
   - Search Query: `ethereum`
   - Count: `3`
5. Add Script #3:
   - Script: `postTweet`
   - Text: `GM crypto fam! ☀️🚀`
6. Create Profile

**Kết quả:**
- Launch profile → Scripts chạy tuần tự:
  1. Like 5 tweets về bitcoin/crypto
  2. Retweet 3 tweets về ethereum
  3. Post tweet "GM crypto fam! ☀️🚀"
  4. Hoàn thành tất cả tự động!

### Ví dụ 3: Follow influencers

**Setup:**
1. Tạo profile: "Twitter Growth Bot"
2. Add Script #1:
   - Script: `followUsers`
   - Username: `@elonmusk`
3. Add Script #2:
   - Script: `followUsers`
   - Username: `@vitalikbuterin`
4. Create Profile

**Kết quả:**
- Launch → Tự động follow cả 2 accounts

## Available Scripts

### 📖 Reading Scripts
- **readTimeline**: Đọc timeline
  - Parameters: `count` (số tweets)
- **searchAndRead**: Tìm và đọc
  - Parameters: `query`, `count`

### ❤️ Caring Scripts
- **likeTweets**: Like tweets tự động
  - Parameters: `searchQuery`, `count`
- **retweetTweets**: Retweet tự động
  - Parameters: `searchQuery`, `count`
- **followUsers**: Follow user
  - Parameters: `username` (vd: @elonmusk)

### ✍️ Posting Scripts
- **postTweet**: Đăng tweet
  - Parameters: `text`

## UI Flow

```
Create Profile Modal
│
├─ Profile Name: [___________]
│
├─ 📱 Choose Apps
│  └─ [✓] Twitter/X
│
├─ ⚡ Auto-Run Scripts (Optional)
│  │
│  ├─ [Add Script] button
│  │
│  ├─ Assigned Scripts:
│  │  ┌────────────────────────────┐
│  │  │ likeTweets                 │ [🗑️]
│  │  │ searchQuery: bitcoin, count: 10 │
│  │  └────────────────────────────┘
│  │  ┌────────────────────────────┐
│  │  │ postTweet                  │ [🗑️]
│  │  │ text: GM crypto!           │
│  │  └────────────────────────────┘
│  │
│  └─ ⚡ 2 script(s) sẽ tự động chạy khi launch
│
└─ [Cancel] [Create Profile]
```

## Add Script Form

Khi click **Add Script**:

```
┌────────────────────────────────────┐
│ Chọn Script:                       │
│ [Choose Script ▼]                  │
│   📖 Reading                        │
│     - Read Timeline                │
│     - Search & Read                │
│   ❤️ Caring                         │
│     - Like Tweets                  │
│     - Retweet Tweets               │
│     - Follow Users                 │
│   ✍️ Posting                        │
│     - Post Tweet                   │
│                                    │
│ [Dynamic parameters form]          │
│                                    │
│ [Cancel] [Add]                     │
└────────────────────────────────────┘
```

## Backend Architecture

### Profile Metadata

Scripts được lưu trong `profile.metadata.autoRunScripts`:

```json
{
  "id": "profile_123",
  "name": "Bitcoin Bot",
  "metadata": {
    "selectedApps": ["twitter.apk"],
    "autoRunScripts": [
      {
        "scriptName": "likeTweets",
        "scriptData": {
          "searchQuery": "bitcoin",
          "count": 10
        }
      },
      {
        "scriptName": "postTweet",
        "scriptData": {
          "text": "GM crypto fam!"
        }
      }
    ]
  }
}
```

### Activation Flow

```typescript
// ProfileManager.activateProfile()
async activateProfile(profileId: string) {
  // 1. Launch instance
  await controller.launchInstance(instanceName);

  // 2. Install apps
  await autoInstallApps(profileId);

  // 3. Check for auto-run scripts
  const autoRunScripts = profile.metadata?.autoRunScripts || [];

  if (autoRunScripts.length > 0) {
    // Execute scripts automatically
    await executeAutoRunScripts(profileId, autoRunScripts);
  } else {
    // No scripts, just launch Google
    await autoLaunchApp(profileId);
  }
}
```

### Script Execution

```typescript
// ProfileManager.executeAutoRunScripts()
private async executeAutoRunScripts(
  profileId: string,
  scripts: Array<{scriptName: string; scriptData: any}>
) {
  // Wait for boot
  await sleep(5000);

  // Execute each script in sequence
  for (const script of scripts) {
    await scriptExecutor.queueScript({
      profileId,
      scriptType: 'twitter',
      scriptName: script.scriptName,
      scriptData: script.scriptData
    });
  }
}
```

## Khác biệt với Manual Run Script

| Feature | Auto-Run Scripts | Manual Run Script |
|---------|-----------------|-------------------|
| **Trigger** | Tự động khi launch | Click nút "Run Script" |
| **Setup** | Lúc tạo profile | Sau khi launch |
| **Use case** | Automation, bots | Ad-hoc tasks |
| **Multiple scripts** | ✅ Assign nhiều scripts | ❌ Chạy từng cái một |
| **Persistence** | ✅ Lưu vào profile | ❌ Temporary |

## Best Practices

### 1. Test từng script trước

Trước khi assign nhiều scripts, test từng cái riêng:
- Tạo profile test
- Assign 1 script
- Launch và xem kết quả
- OK → Thêm vào profile chính

### 2. Thứ tự scripts quan trọng

Scripts chạy **tuần tự** theo thứ tự assign:
```
✅ GOOD:
1. likeTweets (warm up account)
2. retweetTweets (more engagement)
3. postTweet (final action)

❌ BAD:
1. postTweet (too aggressive)
2. likeTweets (awkward order)
```

### 3. Delay giữa actions

Mỗi script đã có delay built-in, nhưng nên:
- Không assign quá nhiều scripts (max 3-5)
- Không set count quá cao (max 10-20)
- Monitor log để check performance

### 4. Profile mặc định không scripts

Tạo ít nhất 1 profile **KHÔNG có scripts**:
- Để test manual
- Để debug issues
- Để tương tác tự do

### 5. Naming convention

Đặt tên profile rõ ràng:
- "Bot - Bitcoin Liker" → Biết ngay là bot
- "Manual - Test Profile" → Biết là manual
- "Auto - Crypto Engagement" → Automation profile

## Troubleshooting

### Scripts không chạy

**Check:**
1. Profile có metadata.autoRunScripts?
   ```bash
   # Xem file: data/profiles/<profileId>.json
   cat data/profiles/profile_*.json | grep autoRunScripts
   ```

2. Server log có gì?
   ```
   [ProfileManager] Auto-executing 2 script(s) for Bitcoin Bot
   [ProfileManager] Auto-executing script "likeTweets" on Bitcoin Bot
   [MobileScriptExecutor] Queued script: likeTweets
   ```

3. ScriptExecutor có được inject?
   ```
   [Server] scriptExecutor injected into profileManager
   ```

### Scripts chạy nhưng lỗi

**Check:**
1. Twitter app có được cài?
2. ADB connection OK?
3. Coordinates đúng cho resolution?
4. Script parameters hợp lệ?

### Instance boot nhưng không làm gì

**Check:**
- autoRunScripts = [] → Instance sẽ mở Google (mặc định)
- autoRunScripts = [scripts] → Scripts sẽ chạy thay vì mở Google

## Use Cases

### Bot farming
```
Profile: "Farm Bot 1"
Scripts:
- likeTweets (bitcoin, count=5)
- retweetTweets (crypto, count=3)
- followUsers (@cryptoinfluencer)
→ Chạy 24/7 cho nhiều accounts
```

### Engagement automation
```
Profile: "Engagement Bot"
Scripts:
- searchAndRead (my_brand, count=20)
- likeTweets (my_brand, count=10)
→ Tự động engage với brand mentions
```

### Content distribution
```
Profile: "Content Poster"
Scripts:
- postTweet (text="Check out our new product!")
- postTweet (text="Limited time offer!")
→ Schedule posts tự động
```

### Growth hacking
```
Profile: "Growth Bot"
Scripts:
- followUsers (@competitor_follower_1)
- followUsers (@competitor_follower_2)
- likeTweets (industry_keyword, count=20)
→ Grow followers organically
```

## Roadmap

- [ ] Edit auto-run scripts sau khi tạo profile
- [ ] Clone profile with scripts
- [ ] Script marketplace/templates
- [ ] Conditional scripts (if-then logic)
- [ ] Schedule scripts (time-based)
- [ ] Loop scripts (repeat X times)
- [ ] Instagram & TikTok scripts
- [ ] Visual script builder (drag & drop)

## Kết luận

Auto-Run Scripts biến Worker Mobile thành công cụ automation hoàn chỉnh! 🎉

**Workflow hoàn hảo:**
1. Tạo profile → Assign scripts → Create
2. Launch profile → Ngồi uống cà phê ☕
3. Scripts tự chạy → Done! ✅

Không cần click thủ công, không cần monitor, chỉ cần setup 1 lần và automation forever! 🚀
