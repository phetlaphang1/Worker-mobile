# ⚡ QUICK START

## Chạy ngay trong 3 bước:

### **Bước 1: Kiểm tra hệ thống**
```bash
cd Worker-mobile
npm run check
```

✅ Nếu PASSED → tiếp tục bước 2

### **Bước 2: Chạy server**
```bash
npm run dev
```

Thấy message này là OK:
```
╔════════════════════════════════════════════╗
║       Mobile Worker System Started          ║
╠════════════════════════════════════════════╣
║  API Server: http://localhost:5051         ║
╚════════════════════════════════════════════╝
```

### **Bước 3: Test (Terminal mới)**
```bash
cd Worker-mobile
npm test
```

Sẽ tự động:
1. Tạo 2 profiles
2. Launch 2 LDPlayer instances (chờ ~30s)
3. Execute scripts (like tweets, post tweet)
4. Show kết quả
5. Cleanup

---

## 🎯 Sử dụng thực tế

### Tạo profile và chạy script:

```bash
# 1. Tạo profile
curl -X POST http://localhost:5051/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Worker 1","settings":{"resolution":"720,1280","cpu":2,"memory":2048}}'

# Lưu lại profileId từ response

# 2. Launch LDPlayer
curl -X POST http://localhost:5051/api/profiles/PROFILE_ID/activate

# Chờ 15-20s để LDPlayer khởi động

# 3. Execute script
curl -X POST http://localhost:5051/api/profiles/PROFILE_ID/execute-script \
  -H "Content-Type: application/json" \
  -d '{"scriptType":"twitter","scriptName":"likeTweets","scriptData":{"searchQuery":"crypto","count":3}}'

# 4. Check status
curl http://localhost:5051/api/scripts
```

---

## 📝 Available Commands

```bash
npm run check      # Kiểm tra hệ thống
npm run dev        # Chạy server
npm test           # Test tự động
npm run dev:full   # Chạy server + client UI
```

---

## 🔥 Scripts có sẵn

### Twitter:
- `likeTweets` - Like tweets
- `followUser` - Follow user
- `postTweet` - Post tweet
- `retweet` - Retweet
- `searchAndRead` - Search và scroll

### Custom:
```json
{
  "scriptType": "custom",
  "scriptData": {
    "adbCommands": [
      {"type": "tap", "x": 360, "y": 640},
      {"type": "swipe", "x1": 360, "y1": 800, "x2": 360, "y2": 200},
      {"type": "input", "text": "Hello"},
      {"type": "wait", "duration": 2000}
    ]
  }
}
```

---

## ❓ Troubleshooting

**Port 5051 bị chiếm:**
```bash
netstat -ano | findstr :5051
taskkill /PID <PID> /F
```

**LDPlayer không launch:**
```bash
taskkill /IM dnplayer.exe /F
npm run dev
```

**Xem log chi tiết:**
```bash
cd Worker-mobile/logs
```

---

## 📚 Đọc thêm

- [START_HERE.md](START_HERE.md) - Hướng dẫn chi tiết
- [README.md](README.md) - API documentation
- [test-boxphone.js](test-boxphone.js) - Xem code test
