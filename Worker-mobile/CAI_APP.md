# 📱 Cài App Cho Instances - Hướng Dẫn Nhanh

## 🎯 TL;DR (Quá dài không đọc)

```bash
# 1. Download APK → Đặt vào apks/
# 2. Config .env
# 3. Launch instance → APP TỰ ĐỘNG CÀI!
```

---

## 🚀 Cách 1: Auto-Install (Đơn giản nhất)

### **Bước 1: Download APK**

Vào https://www.apkmirror.com/ download:
- Twitter APK
- Facebook APK
- Instagram APK
- Telegram APK
- ...

### **Bước 2: Đặt vào folder**

```bash
Worker-mobile/
└── apks/
    ├── twitter.apk      ← Đặt file vào đây
    ├── facebook.apk
    ├── instagram.apk
    └── telegram.apk
```

### **Bước 3: Config .env**

Mở file `.env`:

```bash
# Bật auto-install
AUTO_INSTALL_TWITTER=true
AUTO_INSTALL_FACEBOOK=true
AUTO_INSTALL_INSTAGRAM=true

# Path đến APK
TWITTER_APK_PATH=./apks/twitter.apk
FACEBOOK_APK_PATH=./apks/facebook.apk
INSTAGRAM_APK_PATH=./apks/instagram.apk
```

### **Bước 4: Launch instance**

```bash
# Mở UI: http://localhost:5173
# Tab Profiles → Click "Launch"

→ Apps TỰ ĐỘNG được cài! ✅
```

**Xong!** Không cần làm gì thêm.

---

## ⚡ Cách 2: Clone Profile (Nhanh nhất)

### **Một lần duy nhất:**

```bash
# 1. Tạo profile "Base"
# 2. Launch → Chờ apps auto-install
# 3. Profile "Base" giờ có full apps
```

### **Sau đó:**

```bash
# Clone để tạo profile mới
# Apps đã có sẵn, không cần cài lại!

Clone "Base" → "Worker 1" → Done! (20 giây)
Clone "Base" → "Worker 2" → Done! (20 giây)
Clone "Base" → "Worker 3" → Done! (20 giây)
```

**→ Nhanh gấp 10 lần!** ⚡

---

## 📋 Package Names (Cần thiết)

```
Twitter:    com.twitter.android
Facebook:   com.facebook.katana
Instagram:  com.instagram.android
Telegram:   org.telegram.messenger
TikTok:     com.zhiliaoapp.musically
WhatsApp:   com.whatsapp
```

---

## 🔧 Thêm App Mới

### **Ví dụ: Thêm WhatsApp**

**1. Download APK:**
```
https://www.apkmirror.com/apk/whatsapp-inc/whatsapp/
→ Download whatsapp.apk → Đặt vào apks/
```

**2. Thêm vào `.env`:**
```bash
AUTO_INSTALL_WHATSAPP=true
WHATSAPP_APK_PATH=./apks/whatsapp.apk
```

**3. Thêm vào config:**

Edit file `server/config/apps.config.ts`:

```typescript
{
  name: 'WhatsApp',
  packageName: 'com.whatsapp',
  apkPath: process.env.WHATSAPP_APK_PATH || './apks/whatsapp.apk',
  autoInstall: process.env.AUTO_INSTALL_WHATSAPP === 'true',
}
```

**4. Restart server:**
```bash
npm run dev
```

**5. Launch instance → WhatsApp tự động cài!**

---

## ❓ FAQ

### **Q: Apps biến mất sau khi tắt instance?**
A: Không! Apps được lưu trong instance. Chỉ mất khi xóa profile.

### **Q: Cài bao nhiêu apps được?**
A: Không giới hạn! Nhưng khuyến nghị 3-5 apps để instance không quá nặng.

### **Q: Có cần cài lại mỗi lần launch không?**
A: KHÔNG! Cài 1 lần → Có mãi mãi.

### **Q: Clone profile có copy apps không?**
A: CÓ! Clone = Copy toàn bộ (apps + settings + data).

---

## 📊 So sánh

| Cách | Lần đầu | Lần sau | Apps |
|------|---------|---------|------|
| **Auto-install** | 2 phút | 2 phút | ✅ Tự động cài |
| **Clone** | 2 phút (base) | 20 giây | ✅ Có sẵn |
| **Manual** | 5-10 phút | 5-10 phút | ❌ Phải cài tay |

**→ Dùng Clone = Win!** 🏆

---

## 💡 Tips

### **1. Tạo Base Profile:**
```bash
# Lần đầu:
1. Tạo "Base Profile"
2. Launch → Chờ apps cài
3. (Optional) Login apps
4. Stop

# Sau đó:
Clone "Base" → Tạo workers mới nhanh như chớp!
```

### **2. APK Architecture:**
```
LDPlayer dùng: x86 hoặc ARM
Download:      Universal APK (work cho cả 2)
```

### **3. Check apps đã cài:**
```bash
# Qua API
GET /api/profiles/{profileId}

# Response:
{
  "apps": {
    "twitter": { "installed": true },
    "facebook": { "installed": true }
  }
}
```

---

## 🎯 Workflow Thực Tế

```bash
# === LẦN ĐẦU (5 phút) ===
1. Download APKs → apks/
2. Config .env → AUTO_INSTALL_*=true
3. Tạo "Base Profile"
4. Launch → Apps auto-install
5. (Optional) Login apps
6. Stop

# === SAU ĐÓ (30 giây/worker) ===
1. Clone "Base" → "Worker 1"
2. Launch → Apps có sẵn!
3. Run scripts
4. Profit! 🚀
```

---

## 📝 Summary

**3 bước đơn giản:**
1. APK vào `apks/`
2. Config `.env`
3. Launch → Auto cài!

**Hoặc:**
1. Tạo Base Profile
2. Clone khi cần
3. Done!

**Apps có sẵn mọi lúc, không cần cài lại!** ✅
