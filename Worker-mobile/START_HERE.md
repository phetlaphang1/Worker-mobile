# 🚀 START HERE - Hướng dẫn chạy Worker-Mobile

## ✅ Kiểm tra trước khi chạy

### 1. LDPlayer đã cài chưa?
Mở Command Prompt và chạy:
```bash
D:\LDPlayer\LDPlayer9\ldconsole.exe list2
```

**Kết quả mong đợi:** Hiển thị danh sách LDPlayer instances (có thể rỗng)

**Nếu lỗi:** Cài LDPlayer từ https://www.ldplayer.net/

---

### 2. Kiểm tra .env
File `.env` đã có trong `Worker-mobile/`:
```bash
LDCONSOLE_PATH=D:\LDPlayer\LDPlayer9\ldconsole.exe
ADB_PATH=D:\LDPlayer\LDPlayer9\adb.exe
PORT=5051
```

✅ Đã OK!

---

### 3. Dependencies đã cài chưa?
```bash
cd Worker-mobile
npm install
```

✅ Đã có 636 packages!

---

## 🎯 Cách chạy

### **Option 1: Chạy server đơn giản**

```bash
cd Worker-mobile
npm run dev
```

Server sẽ chạy tại: **http://localhost:5051**

Bạn sẽ thấy:
```
╔════════════════════════════════════════════╗
║       Mobile Worker System Started          ║
╠════════════════════════════════════════════╣
║  API Server: http://localhost:5051         ║
║  WebSocket:  ws://localhost:5051           ║
║  Environment: development                  ║
╚════════════════════════════════════════════╝
```

---

### **Option 2: Test tự động (Recommended)**

Terminal 1 - Chạy server:
```bash
cd Worker-mobile
npm run dev
```

Terminal 2 - Chạy test (sau khi server đã chạy):
```bash
cd Worker-mobile
npm test
```

Test sẽ tự động:
1. ✅ Tạo 2 profiles
2. ✅ Launch 2 LDPlayer instances
3. ✅ Execute scripts (like tweets, post tweet)
4. ✅ Monitor progress
5. ✅ Cleanup

---

## 📋 Sử dụng API

### 1. Tạo Profile
```bash
curl -X POST http://localhost:5051/api/profiles \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Worker 1\",
    \"settings\": {
      \"resolution\": \"720,1280\",
      \"cpu\": 2,
      \"memory\": 2048
    }
  }"
```

**Response:**
```json
{
  "profile": {
    "id": "profile_1234567890_abc",
    "name": "Worker 1",
    "port": 5555,
    "status": "inactive"
  }
}
```

---

### 2. Launch LDPlayer Instance
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1234567890_abc/activate
```

**Sau 15-20 giây**, LDPlayer window sẽ xuất hiện!

---

### 3. Execute Script
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1234567890_abc/execute-script \
  -H "Content-Type: application/json" \
  -d "{
    \"scriptType\": \"twitter\",
    \"scriptName\": \"likeTweets\",
    \"scriptData\": {
      \"searchQuery\": \"crypto\",
      \"count\": 3
    }
  }"
```

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "script_1234567890_xyz",
    "status": "pending",
    "scriptType": "twitter",
    "scriptName": "likeTweets"
  }
}
```

---

### 4. Check Script Status
```bash
curl http://localhost:5051/api/scripts
```

**Response:**
```json
[
  {
    "id": "script_1234567890_xyz",
    "status": "completed",
    "result": { "liked": 3 }
  }
]
```

---

### 5. Stop Instance
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1234567890_abc/deactivate
```

---

## 🔥 Chạy nhiều instances (Advanced)

### JavaScript/Node.js:
```javascript
import axios from 'axios';

const API = 'http://localhost:5051';

// 1. Tạo 5 profiles
const profiles = [];
for (let i = 0; i < 5; i++) {
  const res = await axios.post(`${API}/api/profiles`, {
    name: `Worker ${i + 1}`,
    settings: { resolution: '720,1280', cpu: 2, memory: 2048 }
  });
  profiles.push(res.data.profile);
}

// 2. Launch tất cả (parallel)
await Promise.all(
  profiles.map(p => axios.post(`${API}/api/profiles/${p.id}/activate`))
);

// 3. Execute scripts
await Promise.all(
  profiles.map(p =>
    axios.post(`${API}/api/profiles/${p.id}/execute-script`, {
      scriptType: 'twitter',
      scriptName: 'likeTweets',
      scriptData: { searchQuery: 'blockchain', count: 3 }
    })
  )
);

// 4. Monitor
const scripts = await axios.get(`${API}/api/scripts`);
console.log(scripts.data);
```

---

## 📊 Available Scripts

### Twitter Scripts:
- `likeTweets` - Like tweets (cần searchQuery + count)
- `followUser` - Follow user (cần username)
- `postTweet` - Post tweet (cần text)
- `retweet` - Retweet (cần searchQuery)
- `searchAndRead` - Search và scroll (cần query + count)

### Custom Scripts:
```json
{
  "scriptType": "custom",
  "scriptName": "custom",
  "scriptData": {
    "adbCommands": [
      { "type": "tap", "x": 360, "y": 640 },
      { "type": "swipe", "x1": 360, "y1": 800, "x2": 360, "y2": 200 },
      { "type": "input", "text": "Hello World" },
      { "type": "wait", "duration": 2000 },
      { "type": "screenshot", "path": "./screenshot.png" }
    ]
  }
}
```

---

## ❓ Troubleshooting

### ❌ Server không start
```bash
# Check port 5051 có bị chiếm không
netstat -ano | findstr :5051

# Kill process nếu cần
taskkill /PID <PID> /F

# Thử lại
npm run dev
```

### ❌ LDPlayer không launch
1. **Kiểm tra path:**
   ```bash
   D:\LDPlayer\LDPlayer9\ldconsole.exe list2
   ```

2. **Tắt tất cả LDPlayer instances:**
   ```bash
   taskkill /IM dnplayer.exe /F
   ```

3. **Thử lại**

### ❌ Script timeout
- Tăng memory: Settings → Performance → 3GB
- Bật VT trong BIOS
- Giảm số instances đang chạy

### ❌ Twitter app không có
- Download Twitter APK: https://www.apkmirror.com/apk/twitter-inc/twitter/
- Đặt vào `Worker-mobile/apks/twitter.apk`
- Update `.env`:
  ```
  TWITTER_APK_PATH=./apks/twitter.apk
  ```

---

## 🎯 Quick Commands

```bash
# Start server
cd Worker-mobile && npm run dev

# Test automation (terminal mới)
cd Worker-mobile && npm test

# Check profiles
curl http://localhost:5051/api/profiles

# Check scripts
curl http://localhost:5051/api/scripts

# Get statistics
curl http://localhost:5051/api/statistics
```

---

## 📈 Performance Tips

1. **Clone profiles thay vì tạo mới:** Nhanh hơn 10x
2. **Reuse sessions:** Keep app open giữa các scripts
3. **Batch operations:** Chạy nhiều scripts cùng lúc
4. **Lower resolution:** 540x960 thay vì 720x1280

---

## ✨ Bắt đầu ngay!

```bash
# Terminal 1
cd Worker-mobile
npm run dev

# Terminal 2 (sau khi server chạy)
cd Worker-mobile
npm test
```

Enjoy! 🚀
