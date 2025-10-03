# ✅ CÁCH CHẠY WORKER-MOBILE - Đơn giản nhất

## Hệ thống đã FIX và hoạt động!

### Bước 0: Setup Twitter APK (Tùy chọn - để tự động cài Twitter)

1. **Download Twitter APK:**
   - APKMirror: https://www.apkmirror.com/apk/twitter-inc/twitter/
   - Recommended version: Twitter v9.95.0

2. **Đặt vào folder:**
   ```bash
   # Tạo folder apks (nếu chưa có)
   mkdir Worker-mobile/apks

   # Copy Twitter APK vào
   # Đổi tên thành twitter.apk
   ```

3. **Kiểm tra .env:**
   ```
   TWITTER_APK_PATH=./apks/twitter.apk
   AUTO_INSTALL_TWITTER=true
   ```

✅ **Nếu có Twitter APK**, mỗi khi launch instance, Twitter sẽ tự động được cài đặt!

⚠️ **Nếu không có APK**, hệ thống vẫn chạy bình thường, chỉ không tự động cài Twitter.

---

### Bước 1: Chạy Server

```bash
cd Worker-mobile
npm run dev
```

Server sẽ chạy tại **http://localhost:5051**

### Bước 2: Sử dụng hệ thống

#### Tạo Profile mới:
```bash
curl -X POST http://localhost:5051/api/profiles -H "Content-Type: application/json" -d "{\"name\":\"My Worker\",\"settings\":{\"resolution\":\"720,1280\",\"cpu\":2,\"memory\":2048}}"
```

Sẽ trả về profile ID, ví dụ: `profile_1759466800500_lhgtzoddn`

#### Launch LDPlayer instance:
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1759466800500_lhgtzoddn/activate
```

LDPlayer window sẽ xuất hiện sau 15-30 giây.

#### Execute script trên instance:
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1759466800500_lhgtzoddn/execute-script -H "Content-Type: application/json" -d "{\"scriptType\":\"custom\",\"scriptName\":\"test\",\"scriptData\":{\"adbCommands\":[{\"type\":\"tap\",\"x\":360,\"y\":640}]}}"
```

#### Xem danh sách profiles:
```bash
curl http://localhost:5051/api/profiles
```

#### Stop instance:
```bash
curl -X POST http://localhost:5051/api/profiles/profile_1759466800500_lhgtzoddn/deactivate
```

---

## ✅ Những gì đã FIX:

1. ✅ **Tạo profile thành công** - Code đã xử lý ldconsole exit code 6/7
2. ✅ **Port calculation đúng** - Lấy index từ ldconsole list2
3. ✅ **Error handling tốt** - Không crash khi ldconsole có warning
4. ✅ **Server chạy ổn định** - API hoạt động bình thường

---

## 📋 API Endpoints hoạt động:

- `GET /health` - Check server status
- `GET /api/profiles` - List all profiles
- `POST /api/profiles` - Create new profile
- `POST /api/profiles/:id/activate` - Launch instance
- `POST /api/profiles/:id/deactivate` - Stop instance
- `POST /api/profiles/:id/execute-script` - Run script
- `GET /api/scripts` - List all scripts
- `GET /api/statistics` - Get statistics

---

## 🎯 Sử dụng từ code (JavaScript/Node.js):

```javascript
import axios from 'axios';

const API = 'http://localhost:5051';

// 1. Tạo profile
const res = await axios.post(`${API}/api/profiles`, {
  name: 'Worker 1',
  settings: { resolution: '720,1280', cpu: 2, memory: 2048 }
});

const profileId = res.data.profile.id;

// 2. Launch instance
await axios.post(`${API}/api/profiles/${profileId}/activate`);

// 3. Chạy script
await axios.post(`${API}/api/profiles/${profileId}/execute-script`, {
  scriptType: 'custom',
  scriptName: 'tap-test',
  scriptData: {
    adbCommands: [
      { type: 'tap', x: 360, y: 640 },
      { type: 'wait', duration: 2000 },
      { type: 'tap', x: 360, y: 800 }
    ]
  }
});

// 4. Stop
await axios.post(`${API}/api/profiles/${profileId}/deactivate`);
```

---

## ⚠️ Lưu ý:

- Launch instance mất 15-30 giây
- Mỗi instance chiếm ~2GB RAM
- Tối đa 5 instances cùng lúc (config trong .env)
- Port range: 5555-5565 (index 0-5)

---

**Hệ thống Worker-mobile đã sẵn sàng sử dụng! 🚀**
