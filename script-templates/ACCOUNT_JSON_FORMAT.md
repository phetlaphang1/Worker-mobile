# Format JSON cho Tab Account

## 📝 Cách lưu username/password trong Profile

### Bước 1: Mở Profile Details
1. Click vào profile bạn muốn config
2. Chọn tab **"Account"** (icon 🔑)

### Bước 2: Nhập JSON theo format

```json
{
  "x": {
    "username": "your_email@gmail.com",
    "password": "YourPassword123"
  },
  "telegram": {
    "phone": "+84901234567",
    "password": "TelegramPass456"
  },
  "facebook": {
    "email": "fb_account@gmail.com",
    "password": "FbPass789"
  }
}
```

### Bước 3: Save

Click "Save" hoặc "Update Profile"

---

## 🎯 Các Format Thường Dùng

### 1. X (Twitter)
```json
{
  "x": {
    "username": "myemail@gmail.com",
    "password": "MyPassword123"
  }
}
```

**Hoặc dùng phone:**
```json
{
  "x": {
    "username": "+84901234567",
    "password": "MyPassword123"
  }
}
```

**Hoặc dùng username:**
```json
{
  "x": {
    "username": "myusername",
    "password": "MyPassword123"
  }
}
```

### 2. Telegram
```json
{
  "telegram": {
    "phone": "+84901234567",
    "password": "TelegramPass123",
    "api_id": "12345678",
    "api_hash": "abcdef123456"
  }
}
```

### 3. Facebook
```json
{
  "facebook": {
    "email": "myemail@gmail.com",
    "password": "FbPassword123",
    "2fa_secret": "ABCD1234EFGH5678"
  }
}
```

### 4. Instagram
```json
{
  "instagram": {
    "username": "my_insta_username",
    "password": "InstaPass123"
  }
}
```

### 5. TikTok
```json
{
  "tiktok": {
    "email": "tiktok@gmail.com",
    "password": "TikTokPass123"
  }
}
```

---

## 🔧 Cách Script Sử Dụng

### Trong script, lấy credentials như sau:

```javascript
// Lấy toàn bộ accounts object
const accounts = context.profile?.metadata?.accounts || context.profile?.accounts;

// Lấy thông tin X (Twitter)
const xAccount = accounts.x;
const username = xAccount.username;  // "myemail@gmail.com"
const password = xAccount.password;  // "MyPassword123"

// Lấy thông tin Telegram
const telegramAccount = accounts.telegram;
const phone = telegramAccount.phone;      // "+84901234567"
const tgPassword = telegramAccount.password;

// Lấy thông tin Facebook
const fbAccount = accounts.facebook;
const fbEmail = fbAccount.email;
const fbPassword = fbAccount.password;
```

### Script template tự động lấy:

```javascript
// Template đã có sẵn code này:
const accounts = context.profile?.metadata?.accounts || context.profile?.accounts;

if (!accounts || !accounts.x) {
  throw new Error('Chưa có thông tin account!');
}

const USERNAME = accounts.x.username;
const PASSWORD = accounts.x.password;

log(`Đăng nhập với account: ${USERNAME}`);
```

---

## 💡 Best Practices

### ✅ Nên làm:
```json
{
  "x": {
    "username": "real_email@gmail.com",
    "password": "StrongPassword123!",
    "note": "Main account for automation"
  }
}
```

### ❌ Không nên:
```json
// ❌ Thiếu dấu ngoặc kép
{
  x: {
    username: "email@gmail.com"
  }
}

// ❌ Thiếu dấu phẩy
{
  "x": {
    "username": "email@gmail.com"
    "password": "pass"
  }
}

// ❌ Format sai
{
  "x": "email@gmail.com",
  "password": "pass"
}
```

### ✅ Đúng format:
```json
{
  "x": {
    "username": "email@gmail.com",
    "password": "MyPassword123"
  },
  "telegram": {
    "phone": "+84901234567",
    "password": "TelegramPass"
  }
}
```

---

## 🔐 Bảo mật

### Lưu ý:
- ✅ Accounts JSON được lưu trong profile metadata
- ✅ Được lưu local trong file `profiles.json`
- ⚠️ **KHÔNG** commit file này lên Git
- ⚠️ **KHÔNG** share profiles.json với người khác

### Thêm vào `.gitignore`:
```
profiles.json
config.json
*.accounts.json
```

---

## 🎯 Ví dụ Đầy Đủ

### Tab Account JSON:
```json
{
  "x": {
    "username": "automation_bot@gmail.com",
    "password": "X_Pass_2024!",
    "note": "Bot account for testing"
  },
  "telegram": {
    "phone": "+84901234567",
    "password": "Tele_Pass_2024",
    "api_id": "12345678",
    "api_hash": "abcdef123456789",
    "note": "Main Telegram bot"
  },
  "facebook": {
    "email": "fb_automation@gmail.com",
    "password": "FB_Pass_2024",
    "2fa_secret": "ABCD1234EFGH5678",
    "note": "Backup account"
  }
}
```

### Script sử dụng:
```javascript
const accounts = context.profile.metadata.accounts;

// Login X
log('Đăng nhập X...');
await loginX(accounts.x.username, accounts.x.password);

// Login Telegram
log('Đăng nhập Telegram...');
await loginTelegram(accounts.telegram.phone, accounts.telegram.password);

// Login Facebook
log('Đăng nhập Facebook...');
await loginFacebook(accounts.facebook.email, accounts.facebook.password);
```

---

## ✅ Checklist

Trước khi run script, đảm bảo:

- [ ] ✅ Đã nhập JSON vào tab "Account"
- [ ] ✅ Format JSON đúng (không lỗi syntax)
- [ ] ✅ Key "x" (hoặc app tương ứng) đã có
- [ ] ✅ Có đủ "username" và "password"
- [ ] ✅ Đã save profile
- [ ] ✅ Script đã có code lấy từ `accounts.x`

Done! Script sẽ tự động lấy username/password từ tab Account! 🎉
