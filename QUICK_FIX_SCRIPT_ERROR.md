# 🚀 Quick Fix: Script Syntax Error

## ❌ Vấn Đề

Script của Profile 8 có lỗi syntax:
```
Identifier 'tapX' has already been declared
```

## ✅ Giải Pháp Nhanh (3 Bước)

### **Bước 1: Rebuild Client** (Bắt buộc!)

```bash
cd client
npm run build
```

Hoặc nếu đang dev mode:
```bash
cd client
npm run dev
```

⏱️ Thời gian: ~30 giây

---

### **Bước 2: Re-record Script trong UI**

1. Mở browser: `http://localhost:5173`
2. Vào tab **Automation → Mobile Builder**
3. Chọn profile **Instance_3** (ID: 8)
4. **Clear tất cả actions cũ** (nếu có)
5. Click **Start Recording**
6. Thực hiện actions trên device emulator:
   - Open app
   - Tap các nút
   - Type text
   - Wait, swipe, ...
7. Click **Stop Recording**
8. Click **"Copy"** hoặc **"Download"**
9. Script mới sẽ tự động save vào profile

⏱️ Thời gian: ~2 phút

---

### **Bước 3: Test Script Mới**

Click button **"Run"** trên profile Instance_3

Hoặc test bằng API:
```bash
curl -X POST http://localhost:5051/api/profiles/8/launch
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "message": "Profile launched and script executing",
  "execution": {
    "status": "RUNNING",
    "taskId": "..."
  }
}
```

⏱️ Thời gian: ~5 giây

---

## 🔍 Tại Sao Bị Lỗi?

**Script cũ (sai):**
```javascript
// Step 3: click
const tapX = Math.round((68.61 / 100) * screenSize.width);  // ✅ OK
const tapY = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX, tapY);

// Step 7: click
const tapX = Math.round((83.15 / 100) * screenSize.width);  // ❌ ERROR!
const tapY = Math.round((95.42 / 100) * screenSize.height);  // tapX đã declare rồi!
await human.tap(tapX, tapY);
```

**Script mới (đúng):**
```javascript
// Step 3: click
const tapX_3 = Math.round((68.61 / 100) * screenSize.width);  // ✅ Unique name
const tapY_3 = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX_3, tapY_3);

// Step 7: click
const tapX_7 = Math.round((83.15 / 100) * screenSize.width);  // ✅ Unique name
const tapY_7 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_7, tapY_7);
```

---

## 🛠️ Đã Fix Trong Code

File `client/src/components/VisualDeviceEmulator.tsx` đã được sửa để generate script với unique variable names.

**Nhưng** profiles cũ vẫn có script cũ → Cần re-record!

---

## ⚡ Alternative: Manual Fix (Nâng Cao)

Nếu không muốn re-record, có thể fix manual:

### **Option A: Edit Profile JSON**

1. Mở `data/profiles/8.json`
2. Tìm `"scriptContent"`
3. Replace tất cả:
   - `const tapX =` → `let tapX =`
   - `const tapY =` → `let tapY =`
   - `const fieldX =` → `let fieldX =`
   - `const fieldY =` → `let fieldY =`

4. Save file
5. **Restart server** để load lại profiles

### **Option B: Use Simple Test Script**

Tạm thời dùng script test đơn giản:

```javascript
log('🚀 Starting test...');
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);
log('✅ App launched!');
```

Update vào profile 8:
```bash
# Edit data/profiles/8.json
# Thay scriptContent thành script test đơn giản ở trên
# Restart server
```

---

## 📝 Tóm Tắt

| Bước | Hành Động | Thời Gian |
|------|-----------|-----------|
| 1 | `cd client && npm run build` | ~30s |
| 2 | Re-record script trong UI | ~2 phút |
| 3 | Test script mới | ~5s |

**Tổng thời gian: ~3 phút** ⏱️

---

## 🎯 Kết Quả Sau Khi Fix

✅ Script không còn syntax error
✅ Script sử dụng unique variable names
✅ Run button hoạt động bình thường
✅ Tất cả profiles mới sẽ generate đúng

---

**LET'S GO!** 🚀

Rebuild client → Re-record script → Test!
