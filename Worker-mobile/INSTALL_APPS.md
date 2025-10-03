# 📱 Hướng dẫn cài ứng dụng vào LDPlayer Instances

## 🎯 Tổng quan

Có 3 cách để cài apps vào instances:

1. **Auto-install khi Launch** (Khuyến nghị) ✅
2. **Clone từ Base Profile** (Nhanh nhất) ⚡
3. **Manual install qua API** 🔧

---

## ✅ Cách 1: Auto-Install khi Launch (Khuyến nghị)

### **Bước 1: Download APK files**

Download các APK từ:
- **APKMirror:** https://www.apkmirror.com/
- **APKPure:** https://apkpure.com/

**Apps phổ biến:**

| App | Package Name | Link Download |
|-----|-------------|---------------|
| Twitter | `com.twitter.android` | https://www.apkmirror.com/apk/twitter-inc/twitter/ |
| Facebook | `com.facebook.katana` | https://www.apkmirror.com/apk/facebook-2/facebook/ |
| Instagram | `com.instagram.android` | https://www.apkmirror.com/apk/instagram/instagram-instagram/ |
| Telegram | `org.telegram.messenger` | https://www.apkmirror.com/apk/telegram-fz-llc/telegram/ |
| TikTok | `com.zhiliaoapp.musically` | https://www.apkmirror.com/apk/tiktok-pte-ltd/tik-tok/ |

### **Bước 2: Đặt APK vào folder**

```bash
# Tạo folder apks (nếu chưa có)
mkdir Worker-mobile/apks

# Copy APK files vào
Worker-mobile/apks/
├── twitter.apk
├── facebook.apk
├── instagram.apk
├── telegram.apk
└── tiktok.apk
```

### **Bước 3: Cấu hình `.env`**

Edit file `Worker-mobile/.env`:

```bash
# Enable auto-install
AUTO_INSTALL_TWITTER=true
AUTO_INSTALL_FACEBOOK=true
AUTO_INSTALL_INSTAGRAM=true
AUTO_INSTALL_TELEGRAM=true
AUTO_INSTALL_TIKTOK=true

# APK paths
TWITTER_APK_PATH=./apks/twitter.apk
FACEBOOK_APK_PATH=./apks/facebook.apk
INSTAGRAM_APK_PATH=./apks/instagram.apk
TELEGRAM_APK_PATH=./apks/telegram.apk
TIKTOK_APK_PATH=./apks/tiktok.apk
```

### **Bước 4: Launch instance**

```bash
# Mở browser: http://localhost:5051
# Tab Profiles → Click "Launch" trên profile

# Hoặc qua API:
curl -X POST http://localhost:5051/api/profiles/PROFILE_ID/activate
```

**Kết quả:**
```
✅ Launching instance...
✅ Auto-installing 5 apps on profile: Worker 1
✅ Installing Twitter from ./apks/twitter.apk...
✅ Twitter installed successfully
✅ Installing Facebook from ./apks/facebook.apk...
✅ Facebook installed successfully
✅ ... (tương tự cho các apps khác)
```

---

## ⚡ Cách 2: Clone từ Base Profile (Nhanh nhất)

### **Tạo Base Profile một lần:**

```bash
# 1. Tạo profile đầu tiên
POST /api/profiles
{
  "name": "Base Profile",
  "settings": {
    "resolution": "720,1280",
    "cpu": 2,
    "memory": 2048
  }
}

# 2. Launch và chờ auto-install apps
POST /api/profiles/{baseProfileId}/activate

# 3. Base Profile giờ có tất cả apps!
```

### **Clone để tạo profiles mới:**

```bash
# Clone base profile → Nhanh hơn 10x so với tạo mới!
# Apps đã được copy sẵn, không cần install lại

# Qua API:
POST /api/profiles/{baseProfileId}/clone
{
  "name": "Worker 2",
  "copyApps": true
}

# Hoặc code:
const newProfile = await profileManager.cloneProfile(
  baseProfileId,
  'Worker 2',
  { copyApps: true, launchAndSetup: true }
);
```

---

## 🔧 Cách 3: Manual Install qua API

### **Install apps sau khi đã launch:**

```bash
POST /api/profiles/{profileId}/install-apps
{
  "apps": [
    {
      "name": "Twitter",
      "apkPath": "./apks/twitter.apk",
      "packageName": "com.twitter.android"
    },
    {
      "name": "Facebook",
      "apkPath": "./apks/facebook.apk",
      "packageName": "com.facebook.katana"
    }
  ]
}
```

---

## 📊 Kiểm tra apps đã cài

### **Qua API:**

```bash
# Get profile info
GET /api/profiles/{profileId}

# Response:
{
  "id": "profile_xxx",
  "name": "Worker 1",
  "status": "active",
  "apps": {
    "twitter": {
      "installed": true,
      "packageName": "com.twitter.android"
    },
    "facebook": {
      "installed": true,
      "packageName": "com.facebook.katana"
    }
  }
}
```

### **Qua ADB:**

```bash
# List tất cả packages
adb -s 127.0.0.1:5555 shell pm list packages

# Check specific app
adb -s 127.0.0.1:5555 shell pm list packages | grep twitter
# Output: package:com.twitter.android
```

---

## 🎯 Workflow khuyến nghị

### **Lần đầu setup:**

```bash
1. Download APKs → Đặt vào Worker-mobile/apks/
2. Cấu hình .env → Bật AUTO_INSTALL_*=true
3. Tạo Base Profile → Launch → Chờ auto-install
4. Clone Base Profile để tạo workers mới
```

### **Hàng ngày:**

```bash
1. Launch profiles → Apps đã có sẵn
2. Chạy scripts → Apps tự động mở
3. Stop profiles khi xong
```

---

## ⚙️ Config Apps

Edit file `server/config/apps.config.ts` để thêm apps mới:

```typescript
export const APPS_CONFIG: AppConfig[] = [
  {
    name: 'Twitter',
    packageName: 'com.twitter.android',
    apkPath: process.env.TWITTER_APK_PATH || './apks/twitter.apk',
    autoInstall: process.env.AUTO_INSTALL_TWITTER === 'true',
  },
  // Thêm app mới:
  {
    name: 'WhatsApp',
    packageName: 'com.whatsapp',
    apkPath: process.env.WHATSAPP_APK_PATH || './apks/whatsapp.apk',
    autoInstall: process.env.AUTO_INSTALL_WHATSAPP === 'true',
  },
];
```

Sau đó thêm vào `.env`:
```bash
AUTO_INSTALL_WHATSAPP=true
WHATSAPP_APK_PATH=./apks/whatsapp.apk
```

---

## 🚀 Performance Tips

### **Clone vs Create New:**

| Action | Time | Apps Status |
|--------|------|-------------|
| Create New + Auto-install | ~2-3 phút | Cài mới |
| Clone from Base Profile | ~20-30 giây | Đã có sẵn ✅ |

**Khuyến nghị:** Tạo 1 Base Profile với full apps → Clone khi cần workers mới!

### **Batch Install:**

Nếu cài nhiều apps cùng lúc, sẽ nhanh hơn:

```javascript
// ❌ Chậm - Install từng app riêng
await installTwitter(profileId);
await installFacebook(profileId);
await installInstagram(profileId);

// ✅ Nhanh - Install batch
await installApps(profileId, [
  { name: 'Twitter', apkPath: './apks/twitter.apk', packageName: 'com.twitter.android' },
  { name: 'Facebook', apkPath: './apks/facebook.apk', packageName: 'com.facebook.katana' },
  { name: 'Instagram', apkPath: './apks/instagram.apk', packageName: 'com.instagram.android' },
]);
```

---

## ❓ Troubleshooting

**Q: Apps không tự động cài?**
```bash
# Check logs
tail -f Worker-mobile/logs/server.log

# Kiểm tra APK path
ls -la Worker-mobile/apks/

# Check .env config
cat Worker-mobile/.env | grep AUTO_INSTALL
```

**Q: APK cài lỗi?**
```bash
# Kiểm tra architecture
# LDPlayer thường dùng ARM hoặc x86
# Download đúng version APK (ARM/x86/Universal)

# Xem log lỗi trong server console
```

**Q: Apps biến mất sau khi tắt instance?**
```bash
# Apps được lưu trong instance data
# Chỉ bị mất nếu:
# 1. Xóa profile
# 2. Xóa instance trong LDMultiPlayer

# Cách fix: Clone lại từ Base Profile
```

---

## 📝 Summary

**Cách tốt nhất:**
1. ✅ Download APKs một lần
2. ✅ Cấu hình `.env` một lần
3. ✅ Tạo Base Profile với full apps
4. ✅ Clone Base Profile khi cần workers mới
5. ✅ Profit! 🚀

**Apps sẽ tự động có trong mọi instance launch sau này!**
