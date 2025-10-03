# Script Execution Guide - Worker Mobile

## Tổng quan

Worker Mobile giờ đã hỗ trợ chạy scripts tự động trên các LDPlayer instances, giống như Worker trên trình duyệt!

## Cách sử dụng

### 1. Launch Instance

Trước khi chạy script, bạn cần launch instance:
- Vào tab **Profiles**
- Click nút **Launch** trên profile muốn sử dụng
- Đợi instance boot (khoảng 5 giây)
- Nút **Run Script** màu tím sẽ xuất hiện

### 2. Chọn Script

Click nút **Run Script** để mở Script Execution Modal:

#### 📖 Reading Scripts (Đọc nội dung)
- **Read Timeline**: Scroll timeline và đọc tweets
  - Parameters: `count` (số tweets muốn đọc)

- **Read Notifications**: Đọc thông báo
  - Parameters: `count` (số thông báo)

- **Search & Read**: Tìm kiếm và đọc tweets
  - Parameters: `query` (từ khóa), `count` (số tweets)

#### ❤️ Caring Scripts (Tương tác)
- **Like Tweets**: Like tweets tự động
  - Parameters: `searchQuery` (tìm kiếm tweets để like), `count` (số tweets)

- **Retweet Tweets**: Retweet tweets tự động
  - Parameters: `searchQuery`, `count`

- **Follow Users**: Follow user
  - Parameters: `username` (vd: @elonmusk)

#### ✍️ Posting Scripts (Đăng bài)
- **Post Tweet**: Đăng tweet mới
  - Parameters: `text` (nội dung tweet)

- **Reply to Tweets**: Reply vào tweets
  - Parameters: `searchQuery`, `text` (nội dung reply)

### 3. Nhập Parameters

Mỗi script có parameters khác nhau:
- **count**: Số lượng hành động (10, 20, 50...)
- **searchQuery**: Từ khóa tìm kiếm (vd: "bitcoin OR crypto")
- **text**: Nội dung tweet/reply
- **username**: Username để follow (vd: @elonmusk)

### 4. Execute

Click nút **Execute Script** để:
- Script được thêm vào hàng đợi
- Instance tự động mở Twitter (nếu chưa mở)
- Thực thi các hành động tự động
- Log kết quả ra server console

## Ví dụ sử dụng

### Ví dụ 1: Like 10 tweets về Bitcoin
1. Launch profile
2. Click **Run Script**
3. Chọn script: **Like Tweets**
4. Nhập:
   - Search Query: `bitcoin`
   - Count: `10`
5. Click **Execute Script**

### Ví dụ 2: Post tweet mới
1. Launch profile
2. Click **Run Script**
3. Chọn script: **Post Tweet**
4. Nhập:
   - Tweet Text: `Hello from Worker Mobile! 🚀`
5. Click **Execute Script**

### Ví dụ 3: Follow user
1. Launch profile
2. Click **Run Script**
3. Chọn script: **Follow Users**
4. Nhập:
   - Username: `@elonmusk`
5. Click **Execute Script**

## Kiến trúc Scripts

### Backend (Server)

File: `server/services/MobileScriptExecutor.ts`

```typescript
// Script được queue và execute tuần tự
await scriptExecutor.queueScript({
  profileId: 'profile_123',
  scriptType: 'twitter',
  scriptName: 'likeTweets',
  scriptData: { searchQuery: 'bitcoin', count: 10 }
});
```

### Automation Layer

File: `server/automation/TwitterMobileAutomation.ts`

Các method automation:
- `launchTwitter()`: Mở Twitter app
- `search(query)`: Tìm kiếm
- `likeTweet(index)`: Like tweet thứ N
- `retweet(index)`: Retweet
- `follow(username)`: Follow user
- `postTweet(text)`: Đăng tweet

### ADB Commands

Scripts sử dụng ADB để tương tác với instance:
```bash
# Tap vào màn hình
adb -s 127.0.0.1:5555 shell input tap 360 640

# Swipe (scroll)
adb -s 127.0.0.1:5555 shell input swipe 360 1000 360 300 300

# Input text
adb -s 127.0.0.1:5555 shell input text "Hello"

# Launch app
adb -s 127.0.0.1:5555 shell am start -n com.twitter.android/...
```

## Tùy chỉnh Scripts

### Thêm script mới

1. **Thêm vào UI** (`client/src/components/worker/ProfilesTab.tsx`):
```tsx
<option value="yourNewScript">Your New Script</option>
```

2. **Thêm parameters**:
```tsx
{selectedScript === 'yourNewScript' && (
  <div>
    <label>Your Parameter:</label>
    <Input
      value={scriptData.yourParam || ''}
      onChange={(e) => setScriptData({ ...scriptData, yourParam: e.target.value })}
    />
  </div>
)}
```

3. **Implement backend** (`server/services/MobileScriptExecutor.ts`):
```typescript
case 'yourNewScript':
  await twitter.launchTwitter();
  // Your automation logic
  return { result: 'success' };
```

### Script Templates

#### Template 1: Simple Action
```typescript
case 'simpleAction':
  await twitter.launchTwitter();
  await twitter.tap(360, 640); // Tap center
  await twitter.sleep(2000);   // Wait 2s
  return { success: true };
```

#### Template 2: Search & Action
```typescript
case 'searchAction':
  await twitter.launchTwitter();
  await twitter.search(scriptData.query);
  for (let i = 0; i < scriptData.count; i++) {
    await twitter.likeTweet(i);
    await twitter.sleep(1000);
  }
  return { liked: scriptData.count };
```

#### Template 3: Batch Actions
```typescript
case 'batchAction':
  await twitter.launchTwitter();
  const results = [];
  for (const item of scriptData.items) {
    const result = await twitter.processItem(item);
    results.push(result);
  }
  return { results };
```

## Debugging

### Xem Log Scripts

Server log sẽ hiển thị:
```
[MobileScriptExecutor] Executing script: likeTweets on profile: Profile_1
[TwitterMobileAutomation] Launching Twitter app
[TwitterMobileAutomation] Searching for: bitcoin
[TwitterMobileAutomation] Liking tweet at index 0
[TwitterMobileAutomation] Liked 10 tweets successfully
```

### Check Script Queue

Xem scripts đang chạy:
```bash
# GET /api/scripts
curl http://localhost:5051/api/scripts
```

### Troubleshooting

**Script không chạy:**
- Instance phải đang active (đã launch)
- Twitter app phải được cài đặt
- ADB connection phải hoạt động

**Script bị lỗi:**
- Kiểm tra log server
- Verify coordinates (tọa độ tap/swipe)
- Check app version compatibility

## Best Practices

1. **Test trên 1 profile trước** khi chạy nhiều profiles
2. **Dùng delay** giữa các hành động để tránh spam
3. **Verify results** qua log trước khi scale up
4. **Monitor instances** khi chạy nhiều scripts cùng lúc
5. **Backup profiles** trước khi test scripts mới

## Advanced Usage

### Chạy script cho nhiều profiles

```typescript
// Server-side code
const profiles = profileManager.getActiveProfiles();
for (const profile of profiles) {
  await scriptExecutor.queueScript({
    profileId: profile.id,
    scriptType: 'twitter',
    scriptName: 'likeTweets',
    scriptData: { searchQuery: 'crypto', count: 5 }
  });
}
```

### Schedule scripts

Sử dụng cron hoặc setTimeout:
```typescript
setInterval(async () => {
  // Chạy script mỗi 1 giờ
  await scriptExecutor.queueScript({...});
}, 3600000);
```

## Roadmap

- [ ] Script scheduling UI
- [ ] Batch execution (nhiều profiles cùng lúc)
- [ ] Script templates library
- [ ] Visual script builder (drag & drop)
- [ ] Performance monitoring dashboard
- [ ] Instagram & TikTok scripts
- [ ] Custom ADB command builder

## Kết luận

Worker Mobile giờ có thể chạy scripts tự động giống Worker trên trình duyệt! 🎉

Các tính năng chính:
✅ UI đẹp để chọn scripts
✅ Parameters tùy chỉnh
✅ Twitter automation (like, retweet, post, follow)
✅ Queue system
✅ ADB-based automation
✅ Multiple profiles support
